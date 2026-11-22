import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, ShoppingBag, X } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { catalogToProducts } from "../api/hydrate";
import { posApi } from "../api/pos";
import { findVariant, uid, useDb, useTill } from "../data/store";
import { CATEGORIES } from "../data/seed";
import type { Category, Product } from "../data/types";
import { livePromos, naira } from "../lib/pricing";
import { Badge, Button, Chip, SearchBox, Swatch, cx, toast } from "../ui/kit";
import { useRegister } from "./common";
import Cart from "./Cart";
import { ProductDialog } from "./ProductDialog";

/** `shipFrom`: the item is sent to the customer from that location, so this store's stock doesn't matter. */
export function addToCart(variantId: string, qty = 1, shipFrom?: string): boolean {
  const db = useDb.getState();
  const till = useTill.getState();
  const found = findVariant(db.products, variantId);
  if (!found) return false;
  const reg = db.registers.find((r) => r.id === till.registerId)!;
  const store = db.stores.find((s) => s.id === reg.storeId);
  const stockId = reg.warehouseId ?? store?.warehouseId ?? reg.storeId;
  const from = shipFrom ?? stockId;
  const here = db.inventory[variantId]?.[from] ?? db.inventory[variantId]?.[reg.storeId] ?? 0;
  const existing = till.cart.lines.find((l) => l.variantId === variantId && !l.discount && l.unitPrice === found.product.price && l.shipFrom === shipFrom);
  const already = till.cart.lines.filter((l) => l.variantId === variantId && l.shipFrom === shipFrom).reduce((a, l) => a + l.qty, 0);
  if (already + qty > here && (shipFrom || db.settings.offline.oversell === "block")) {
    toast(`Only ${here} of ${found.variant.sku} ${shipFrom ? "there" : "in this store"}`, "bad");
    return false;
  }
  if (already + qty > here) toast(`${found.product.name} shows ${here} in stock here. Check the shelf.`, "info");
  till.patchCart({
    lines: existing
      ? till.cart.lines.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l))
      : [...till.cart.lines, { key: uid(), productId: found.product.id, variantId, qty, unitPrice: found.product.price, listPrice: found.product.price, shipFrom }],
  });
  return true;
}

export default function Sell() {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const cartCount = useTill((s) => s.cart.lines.reduce((a, l) => a + l.qty, 0));
  const { store, warehouseId } = useRegister();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [inStock, setInStock] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  // A barcode scanner types like a keyboard: catch stray keystrokes and send them to the search box.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) search.current?.focus();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  // Live catalog search when the local cache has no match.
  useEffect(() => {
    if (!liveMode()) return;
    const t = q.trim();
    if (t.length < 2) return;
    const localHit = products.some(
      (p) =>
        p.name.toLowerCase().includes(t.toLowerCase()) ||
        p.brand.toLowerCase().includes(t.toLowerCase()) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(t.toLowerCase()) || v.barcode.includes(t.toLowerCase())),
    );
    if (localHit && t.length < 8) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      posApi
        .catalog({ q: t, pageSize: 40 })
        .then((rows) => {
          if (cancelled || !rows.length) return;
          const { products: next, inventory: inv } = catalogToProducts(rows, warehouseId);
          const db = useDb.getState();
          const byId = new Map(db.products.map((p) => [p.id, p]));
          for (const p of next) byId.set(p.id, p);
          const inventoryNext = { ...db.inventory };
          for (const [vid, levels] of Object.entries(inv)) {
            inventoryNext[vid] = { ...(inventoryNext[vid] ?? {}), ...levels };
          }
          useDb.setState({ products: [...byId.values()], inventory: inventoryNext });
        })
        .catch(() => undefined);
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, warehouseId, products]);

  const here = (p: Product) => p.variants.reduce((a, v) => a + (inventory[v.id]?.[warehouseId] ?? inventory[v.id]?.[store.id] ?? 0), 0);
  const promotions = useDb((s) => s.promotions);
  const promos = useMemo(() => livePromos(promotions, "pos", store.id).filter((x) => x.kind !== "birthday"), [promotions, store.id]);
  const offer = (p: Product) => promos.find((x) => x.scope.type === "all" || (x.scope.type === "category" ? p.category === x.scope.value : p.brand === x.scope.value));

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "All" || p.category === cat) &&
        (!inStock || here(p) > 0) &&
        (!t || p.name.toLowerCase().includes(t) || p.brand.toLowerCase().includes(t) || p.variants.some((v) => v.sku.toLowerCase().includes(t) || v.barcode.includes(t))),
    );
  }, [products, q, cat, inStock, inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  const scan = async () => {
    const code = q.trim().toLowerCase();
    if (!code) return;
    for (const p of products) {
      const v = p.variants.find((x) => x.barcode === code || x.sku.toLowerCase() === code);
      if (v) {
        if (addToCart(v.id)) toast(`Added ${p.name} · ${v.colour}${v.size !== "One Size" ? ` ${v.size}` : ""}`);
        setQ("");
        return;
      }
    }
    if (liveMode()) {
      try {
        const rows = await posApi.catalog({ barcode: code, sku: code, pageSize: 10 });
        if (rows.length) {
          const { products: next, inventory: inv } = catalogToProducts(rows, warehouseId);
          const db = useDb.getState();
          const byId = new Map(db.products.map((p) => [p.id, p]));
          for (const p of next) byId.set(p.id, p);
          useDb.setState({
            products: [...byId.values()],
            inventory: Object.fromEntries(
              Object.entries({ ...db.inventory, ...inv }).map(([vid, levels]) => [vid, { ...(db.inventory[vid] ?? {}), ...(levels as Record<string, number>) }]),
            ),
          });
          for (const p of next) {
            const v = p.variants.find((x) => x.barcode.toLowerCase() === code || x.sku.toLowerCase() === code);
            if (v && addToCart(v.id)) {
              toast(`Added ${p.name} · ${v.colour}${v.size !== "One Size" ? ` ${v.size}` : ""}`);
              setQ("");
              return;
            }
          }
        }
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Catalog lookup failed");
        return;
      }
    }
    if (list.length === 1) {
      setOpen(list[0]);
      setQ("");
    } else if (!list.length) toast(`Nothing matches "${q.trim()}"`, "bad");
  };

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-line bg-white px-4 pb-3 pt-3">
          <div className="flex gap-2">
            <SearchBox inputRef={search} value={q} onChange={setQ} onEnter={scan} placeholder="Scan a barcode, or search by name, brand or SKU" className="flex-1" />
            <Button variant="secondary" icon={<ScanLine size={17} />} onClick={() => search.current?.focus()} className="hidden sm:inline-flex">
              Scan
            </Button>
          </div>
          <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
            {(["All", ...CATEGORIES] as const).map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)} count={c === "All" ? products.length : products.filter((p) => p.category === c).length}>
                {c}
              </Chip>
            ))}
            <span className="mx-1 h-6 w-px shrink-0 bg-line" />
            <Chip active={inStock} onClick={() => setInStock(!inStock)}>
              In stock here
            </Chip>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {list.length === 0 ? (
            <p className="py-20 text-center text-muted">No products match. Clear the search or filters.</p>
          ) : (
            // Compact tiles: as many columns as fit at ~136px each (about 5 on a laptop, 4 on an iPad, 2 on a phone).
            <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2.5">
              {list.map((p) => {
                const n = here(p);
                const o = offer(p);
                return (
                  <button key={p.id} onClick={() => setOpen(p)} data-testid="product-card" className="group overflow-hidden rounded-lg border border-line bg-white text-left shadow-card transition-all hover:border-line-strong hover:shadow-pop">
                    <div className="relative aspect-square overflow-hidden bg-canvas">
                      <img src={p.image} alt="" loading="lazy" className={cx("h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]", n === 0 && "opacity-60 grayscale")} />
                      {/* Same badges, in the same order, as the website's product card (ProductCard.tsx). */}
                      <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                        {p.priceOnRequest ? (
                          <span className="rounded-[3px] bg-ink px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">On Request</span>
                        ) : (
                          p.compareAt && <span className="rounded-[3px] bg-bad px-1.5 py-0.5 text-[9.5px] font-bold text-white">-{Math.round(((p.compareAt - p.price) / p.compareAt) * 100)}%</span>
                        )}
                        {p.availability === "Limited Pieces" && <span className="rounded-[3px] border border-ink bg-white px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">Limited</span>}
                        {p.availability === "Pre Order" && <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">Pre-order</span>}
                        {n === 0 && p.availability !== "Pre Order" && <Badge tone="neutral" className="h-5 px-1.5 text-[10.5px]">Not in store</Badge>}
                      </div>
                      {o && (
                        <span title={o.name} className="absolute inset-x-1.5 bottom-1.5 truncate rounded bg-ink/85 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                          {o.label}
                        </span>
                      )}
                    </div>
                    <div className="px-2.5 pb-2.5 pt-2">
                      <p className="truncate text-[11px] text-muted">{p.brand}</p>
                      <p className="line-clamp-1 text-[12.5px] font-medium leading-snug">{p.name}</p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className={cx("tnum text-[13px] font-semibold", !!p.compareAt && !p.priceOnRequest && "text-bad")}>{p.priceOnRequest ? `Guide ${naira(p.price)}` : naira(p.price)}</span>
                        {p.compareAt && !p.priceOnRequest && <span className="tnum truncate text-[10.5px] text-faint line-through">{naira(p.compareAt)}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="flex -space-x-1">
                          {p.colours.map((c) => (
                            <Swatch key={c.name} hex={c.hex} size={11} ring />
                          ))}
                        </span>
                        <span className={cx("tnum whitespace-nowrap text-[11px]", n === 0 ? "text-faint" : n <= 3 ? "font-medium text-warn" : "text-muted")}>{n} here</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-line bg-white p-3 md:hidden">
          <Button variant="primary" size="lg" className="w-full" icon={<ShoppingBag size={18} />} onClick={() => setCartOpen(true)}>
            View sale · {cartCount} {cartCount === 1 ? "item" : "items"}
          </Button>
        </div>
      </section>

      <aside className="hidden w-[360px] shrink-0 border-l border-line bg-white md:flex lg:w-[400px]">
        <Cart />
      </aside>
      {cartOpen && (
        <div className="fixed inset-0 z-30 flex flex-col bg-white md:hidden">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <span className="font-semibold">Current sale</span>
            <button aria-label="Back to products" onClick={() => setCartOpen(false)} className="p-2">
              <X size={20} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <Cart />
          </div>
        </div>
      )}
      {open && <ProductDialog product={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

