import { useState } from "react";
import { ArrowLeftRight, Heart, Minus, Plus, Ruler, Sparkles, Truck } from "lucide-react";
import { ConciergeDialog } from "./ConciergeDialog";
import { uid, useDb, useTill } from "../data/store";
import type { Customer, Product, SizeKind } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Dialog, Swatch, cx, toast } from "../ui/kit";
import { auditHere, useRegister } from "./common";
import { addToCart } from "./Sell";

/** Which saved size applies to a product, worked out from its size run. */
export function sizeKindFor(p: Product): SizeKind | null {
  if (p.category === "Footwear") return "shoe";
  if (p.category !== "Clothing") return null;
  if (/^\d+$/.test(p.sizes[0] ?? "")) return "bottom";
  return "top";
}

export const SIZE_LABEL: Record<SizeKind, string> = { top: "Clothing", bottom: "Jeans & trousers (waist)", shoe: "Footwear (EU)" };

export function savedSize(p: Product, c?: Customer) {
  const k = sizeKindFor(p);
  const s = k ? c?.sizes?.[k] : undefined;
  return s && p.sizes.includes(s) ? s : undefined;
}

export function ProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const p = useDb((s) => s.products.find((x) => x.id === product.id)) ?? product;
  const inventory = useDb((s) => s.inventory);
  const stores = useDb((s) => s.stores);
  const customerId = useTill((s) => s.cart.customerId);
  const customer = useDb((s) => s.customers.find((c) => c.id === customerId));
  const shipping = useDb((s) => s.settings.services.delivery);
  const { store } = useRegister();
  const firstColour = p.colours.find((c) => p.variants.some((v) => v.colour === c.name && (inventory[v.id]?.[store.id] ?? 0) > 0)) ?? p.colours[0];
  const saved = savedSize(p, customer);
  const [colour, setColour] = useState(firstColour.name);
  const [concierge, setConcierge] = useState(false);
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0] : saved ?? null);
  const [qty, setQty] = useState(1);
  const variant = size ? p.variants.find((v) => v.colour === colour && v.size === size) : undefined;
  const stockAt = (sid: string, vid = variant?.id) => (vid ? inventory[vid]?.[sid] ?? 0 : 0);
  const onWishlist = !!customer?.wishlist?.includes(p.id);
  // Ship from the warehouse if it has it, otherwise the store with the most.
  const shipSource = variant ? stores.filter((s) => s.id !== store.id && stockAt(s.id) > 0).sort((a, b) => (a.kind === "warehouse" ? -1 : b.kind === "warehouse" ? 1 : stockAt(b.id) - stockAt(a.id)))[0] : undefined;

  return (
    <Dialog title={p.name} sub={`${p.brand} · ${p.category}`} onClose={onClose} size="lg">
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <div>
          <img src={p.image} alt={p.name} className="aspect-[4/5] w-full rounded-xl object-cover" />
          <p className="mt-3 text-[13px] text-muted">{p.description}</p>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={cx("tnum text-2xl font-semibold", !!p.compareAt && !p.priceOnRequest && "text-bad")}>{naira(p.price)}</span>
            {p.compareAt && !p.priceOnRequest && <span className="tnum text-sm text-faint line-through">{naira(p.compareAt)}</span>}
            {onWishlist && (
              <Badge tone="gold" className="ml-auto">
                <Heart size={12} className="mr-1" />
                On {customer!.name.split(" ")[0]}'s wishlist
              </Badge>
            )}
          </div>
          {p.priceOnRequest && (
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-2">
              <b>On Request</b> on the website. This is the guide price: confirm it with the client, and change it on the line in the sale if needed (a supervisor approves).
            </p>
          )}
          {p.availability === "Pre Order" && (
            <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-[13px] text-gold-ink">
              <b>Pre-order.</b> Not in stock yet. Use <b>Reserve with a deposit</b> at checkout to take 50% now, as the website does for drops, or start a concierge request.
            </p>
          )}
          {p.availability === "Limited Pieces" && <p className="mt-3 text-[13px] font-medium text-ink-2">Limited pieces: allocation is shared with the website.</p>}
          <p className="mb-2 mt-5 text-[13px] font-medium text-ink-2">Colour · {colour}</p>
          <div className="flex flex-wrap gap-2">
            {p.colours.map((c) => (
              <button
                key={c.name}
                aria-pressed={colour === c.name}
                onClick={() => {
                  setColour(c.name);
                  setQty(1);
                }}
                className={cx("inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm", colour === c.name ? "border-ink bg-canvas font-medium" : "border-line")}
              >
                <Swatch hex={c.hex} />
                {c.name}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-5 flex items-center gap-2 text-[13px] font-medium text-ink-2">
            Size · stock in this store
            {saved && (
              <span className="inline-flex items-center gap-1 font-normal text-gold-ink">
                <Ruler size={13} />
                {customer!.name.split(" ")[0]} wears {saved}
              </span>
            )}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {p.sizes.map((s) => {
              const v = p.variants.find((x) => x.colour === colour && x.size === s)!;
              const n = stockAt(store.id, v.id);
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSize(s);
                    setQty(1);
                  }}
                  aria-pressed={size === s}
                  className={cx("relative flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition-colors", size === s ? "border-ink bg-ink text-white" : n === 0 ? "border-dashed border-line text-faint" : "border-line hover:border-line-strong")}
                >
                  {s === saved && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />}
                  <span className="font-semibold">{s === "One Size" ? "OS" : p.sizeLabels?.[s] ?? s}</span>
                  <span className={cx("tnum text-[11px]", size === s ? "text-white/75" : n > 0 && n <= 2 ? "text-warn" : "")}>{n} here</span>
                </button>
              );
            })}
          </div>

          {variant && (
            <div className="mt-5 rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px]">
                <span className="font-medium">Stock everywhere</span>
                <span className="tnum text-muted">
                  {variant.sku} · {variant.barcode}
                </span>
              </div>
              <ul className="divide-y divide-line text-[13px]">
                {stores.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2">
                    <span className={s.id === store.id ? "font-medium" : ""}>
                      {s.name}
                      {s.id === store.id && <span className="ml-1.5 text-faint">(this store)</span>}
                    </span>
                    <span className="tnum font-medium">{stockAt(s.id)}</span>
                  </li>
                ))}
              </ul>
              {stockAt(store.id) === 0 && (
                <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                  <Button
                    size="sm"
                    icon={<ArrowLeftRight size={15} />}
                    disabled={!stores.some((s) => s.id !== store.id && s.kind === "store" && stockAt(s.id) > 0)}
                    onClick={() => {
                      const from = stores.filter((s) => s.id !== store.id && s.kind === "store").sort((a, b) => stockAt(b.id) - stockAt(a.id))[0];
                      const t = useDb.getState().addTransfer({ id: uid(), at: new Date().toISOString(), fromStoreId: from.id, toStoreId: store.id, variantId: variant.id, qty: 1, status: "requested", requestedBy: useTill.getState().staffId ?? "", reason: customer ? `Customer waiting: ${customer.name}` : "Customer request" });
                      auditHere("transfer", `Requested ${variant.sku} from ${from.name} (${t.number})`, { ref: t.number });
                      toast(`Transfer ${t.number} requested from ${from.name}. Head office approves it in the admin.`);
                    }}
                  >
                    Request from another store
                  </Button>
                  <Button size="sm" icon={<Sparkles size={15} />} onClick={() => setConcierge(true)}>
                    Concierge request
                  </Button>
                  {shipping && (
                    <Button
                      size="sm"
                      icon={<Truck size={15} />}
                      disabled={!shipSource}
                      data-testid="ship-to-customer"
                      onClick={() => {
                        if (variant && shipSource && addToCart(variant.id, qty, shipSource.id)) {
                          toast(`Added to ship from ${shipSource.name}. Take the address at checkout.`);
                          onClose();
                        }
                      }}
                    >
                      Ship to customer{shipSource ? ` from ${shipSource.kind === "warehouse" ? "warehouse" : shipSource.name}` : ""}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-3 border-t border-line bg-white px-6 pt-4">
        <div className="inline-flex items-center rounded-lg border border-line">
          <button aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-11 w-11 items-center justify-center">
            <Minus size={16} />
          </button>
          <span className="tnum w-8 text-center font-semibold">{qty}</span>
          <button aria-label="More" onClick={() => setQty(qty + 1)} className="flex h-11 w-11 items-center justify-center">
            <Plus size={16} />
          </button>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!variant}
          onClick={() => {
            if (variant && addToCart(variant.id, qty)) {
              toast(`Added ${p.name}`);
              onClose();
            }
          }}
        >
          {variant ? `Add to sale · ${naira(p.price * qty)}` : "Choose a size"}
        </Button>
      </div>
      {concierge && <ConciergeDialog product={p} size={size ?? undefined} onClose={() => (setConcierge(false), onClose())} />}
    </Dialog>
  );
}
