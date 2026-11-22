import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, ClipboardCheck, PackageOpen, PackagePlus, Plus, Send, Truck } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { posApi } from "../api/pos";
import { findVariant, uid, useDb, useTill } from "../data/store";
import { CATEGORIES, label } from "../data/seed";
import type { Category, Delivery, Product, StockCount, Transfer, Variant } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Chip, Dialog, Empty, Field, Input, SearchBox, Segmented, Select, Swatch, cx, fmtDate, fmtTime, toast, type Tone } from "../ui/kit";
import { approvePerm, auditHere, stockKeyOf, useMe, useRegister } from "./common";

function mapApiTransfer(t: any): Transfer {
  return {
    id: t.id,
    number: t.number,
    at: typeof t.createdAt === "string" ? t.createdAt : new Date(t.createdAt ?? Date.now()).toISOString(),
    fromStoreId: t.fromWarehouseId ?? t.fromStoreId,
    toStoreId: t.toWarehouseId ?? t.toStoreId,
    variantId: t.variantId,
    qty: t.qty,
    status: t.status,
    reason: t.reason ?? undefined,
    requestedBy: t.requestedById ?? t.steps?.[0]?.by ?? "",
    steps: (t.steps ?? []).map((s: any) => ({ status: s.status, at: s.at, by: s.by })),
  };
}

function mapApiGrn(d: any): Delivery {
  return {
    id: d.id,
    number: d.number,
    supplier: d.supplier,
    storeId: d.warehouseId,
    expectedAt: typeof d.expectedAt === "string" ? d.expectedAt : new Date(d.expectedAt).toISOString(),
    lines: Array.isArray(d.lines) ? d.lines : [],
    status: d.status === "partial" || d.status === "received" ? d.status : "expected",
    receivedAt: d.receivedAt ? (typeof d.receivedAt === "string" ? d.receivedAt : new Date(d.receivedAt).toISOString()) : undefined,
    receivedBy: d.receivedById ?? undefined,
  };
}

function mapApiCount(c: any): StockCount {
  return {
    id: c.id,
    number: c.number,
    storeId: c.warehouseId,
    at: typeof c.createdAt === "string" ? c.createdAt : c.at ? (typeof c.at === "string" ? c.at : new Date(c.at).toISOString()) : new Date().toISOString(),
    staffId: c.staffId,
    approvedBy: c.approvedById ?? undefined,
    scope: c.scope,
    lines: Array.isArray(c.lines) ? c.lines : [],
  };
}

const REASONS = ["Stock count", "Delivery received", "Damaged", "Lost or stolen", "Found"];

type Tab = "levels" | "count" | "receive" | "transfers";

export default function Stock() {
  const [tab, setTab] = useState<Tab>((sessionStorage.getItem("stock-tab") as Tab) || "levels");
  const { store, warehouseId } = useRegister();
  const transfers = useDb((s) => s.transfers);
  const deliveries = useDb((s) => s.deliveries);
  const stockId = warehouseId;

  const refreshStock = useCallback(async () => {
    if (!liveMode()) return;
    try {
      const [trs, grn, counts] = await Promise.all([posApi.listTransfers(stockId), posApi.listGrn(stockId), posApi.listCounts(stockId)]);
      useDb.setState({
        transfers: (trs as any[]).map(mapApiTransfer),
        deliveries: (grn as any[]).map(mapApiGrn),
        counts: (counts as any[]).map(mapApiCount),
      });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not refresh stock movements");
    }
  }, [stockId]);

  useEffect(() => {
    void refreshStock();
  }, [refreshStock]);

  const waiting = useMemo(
    () => ({
      transfers: transfers.filter((t) => (t.toStoreId === stockId && t.status === "in-transit") || (t.fromStoreId === stockId && t.status === "approved")).length,
      receive: deliveries.filter((d) => d.storeId === stockId && d.status !== "received").length,
    }),
    [transfers, deliveries, stockId],
  );
  const pick = (t: Tab) => (sessionStorage.setItem("stock-tab", t), setTab(t));
  const lbl = (s: string, n = 0) => (
    <span className="inline-flex items-center gap-1.5">
      {s}
      {n > 0 && <span className="tnum rounded-full bg-gold px-1.5 text-[10.5px] font-semibold text-white">{n}</span>}
    </span>
  );
  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
        <p className="mt-1 text-sm text-muted">Stock at {store.name} by size and colour. Changes sync to Inventory in the admin.</p>
        <div className="mt-5">
          <Segmented
            value={tab}
            onChange={pick}
            options={[
              { value: "levels", label: lbl("Stock levels") },
              { value: "count", label: lbl("Count") },
              { value: "receive", label: lbl("Receive", waiting.receive) },
              { value: "transfers", label: lbl("Transfers", waiting.transfers) },
            ]}
          />
        </div>
        <div className="mt-5">
          {tab === "levels" && <Levels />}
          {tab === "count" && <Count />}
          {tab === "receive" && <Receive />}
          {tab === "transfers" && <Transfers />}
        </div>
      </div>
    </div>
  );
}

/** Finds a variant by exact barcode or SKU. */
function lookup(products: Product[], code: string) {
  const c = code.trim().toLowerCase();
  for (const p of products) {
    const v = p.variants.find((x) => x.barcode === c || x.sku.toLowerCase() === c);
    if (v) return { p, v };
  }
}

/* ---------- Stock levels ---------- */

function Levels() {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const stores = useDb((s) => s.stores);
  const { store, warehouseId } = useRegister();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [low, setLow] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<{ p: Product; v: Variant } | null>(null);

  const here = (v: Variant) => inventory[v.id]?.[warehouseId] ?? inventory[v.id]?.[store.id] ?? 0;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => (cat === "All" || p.category === cat) && (!low || p.variants.some((v) => here(v) <= 2)) && (!t || p.name.toLowerCase().includes(t) || p.variants.some((v) => v.sku.toLowerCase().includes(t) || v.barcode.includes(t))));
  }, [products, q, cat, low, inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="Name, SKU or barcode" className="w-full sm:w-80" />
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 self-center bg-line" />
        <Chip active={low} onClick={() => setLow(!low)}>
          Low or out
        </Chip>
      </div>

      <div className="mt-5 space-y-2">
        {list.map((p) => {
          const total = p.variants.reduce((a, v) => a + here(v), 0);
          const expanded = open[p.id] ?? (!!q || low);
          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-line bg-white">
              <button onClick={() => setOpen({ ...open, [p.id]: !expanded })} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas/60">
                {expanded ? <ChevronDown size={17} className="text-faint" /> : <ChevronRight size={17} className="text-faint" />}
                <img src={p.image} alt="" className="h-12 w-10 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                  <span className="text-xs text-muted">
                    {p.brand} · {p.category}
                  </span>
                </span>
                <span className="tnum text-right">
                  <span className="block font-semibold">{total}</span>
                  <span className="text-xs text-muted">here</span>
                </span>
              </button>
              {expanded && (
                <div className="thin-scroll overflow-x-auto border-t border-line p-4">
                  <div className="grid w-max min-w-full gap-1.5" style={{ gridTemplateColumns: `minmax(110px,1fr) repeat(${p.sizes.length}, minmax(58px,1fr))` }}>
                    <span />
                    {p.sizes.map((s) => (
                      <span key={s} className="text-center text-xs font-medium text-muted">
                        {s === "One Size" ? "OS" : s}
                      </span>
                    ))}
                    {p.colours.map((c) => (
                      <Fragment key={c.name}>
                        <span className="flex items-center gap-2 text-[13px]">
                          <Swatch hex={c.hex} />
                          {c.name}
                        </span>
                        {p.sizes.map((s) => {
                          const v = p.variants.find((x) => x.colour === c.name && x.size === s)!;
                          const n = here(v);
                          const elsewhere = stores.filter((x) => stockKeyOf(x) !== warehouseId).reduce((a, x) => a + (inventory[v.id]?.[stockKeyOf(x)] ?? inventory[v.id]?.[x.id] ?? 0), 0);
                          return (
                            <button key={s} onClick={() => setEdit({ p, v })} data-testid={`stock-${v.sku}`} aria-label={`${c.name} ${s}: ${n} here, ${elsewhere} elsewhere`} className={cx("tnum flex h-12 flex-col items-center justify-center rounded-lg border text-sm", n === 0 ? "border-bad/20 bg-bad-soft text-bad" : n <= 2 ? "border-warn/20 bg-warn-soft text-warn" : "border-line hover:border-ink")}>
                              <span className="font-semibold">{n}</span>
                              <span className="text-[10px] text-muted">+{elsewhere}</span>
                            </button>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-faint">Big number: this store. Small: other stores and the warehouse.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {edit && <Adjust p={edit.p} v={edit.v} onClose={() => setEdit(null)} />}
    </>
  );
}

function Adjust({ p, v, onClose }: { p: Product; v: Variant; onClose: () => void }) {
  const db = useDb();
  const { store, warehouseId } = useRegister();
  const hereKey = warehouseId;
  const now = db.inventory[v.id]?.[hereKey] ?? db.inventory[v.id]?.[store.id] ?? 0;
  const [change, setChange] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <Dialog
      title={`${p.name}`}
      sub={`${v.colour}${v.size !== "One Size" ? ` · ${v.size}` : ""} · ${v.sku} · ${v.barcode}`}
      onClose={onClose}
      footer={
        <>
          <Button
            className="mr-auto"
            icon={<ArrowLeftRight size={16} />}
            onClick={async () => {
              const from = db.stores
                .filter((s) => stockKeyOf(s) !== hereKey)
                .sort((a, b) => (db.inventory[v.id]?.[stockKeyOf(b)] ?? 0) - (db.inventory[v.id]?.[stockKeyOf(a)] ?? 0))[0];
              if (!from) return toast("No other location to request from", "bad");
              const fromWh = stockKeyOf(from);
              if (liveMode()) {
                try {
                  const t = (await posApi.createTransfer({ fromWarehouseId: fromWh, toWarehouseId: hereKey, variantId: v.id, qty: 1, reason: "Low stock" })) as any;
                  auditHere("transfer", `Requested ${t.number}: 1 × ${v.sku} from ${from.name}`, { ref: t.number });
                  toast(`${t.number} requested from ${from.name}`);
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Transfer request failed");
                  return;
                }
              } else {
                const t = db.addTransfer({ id: uid(), at: new Date().toISOString(), fromStoreId: from.id, toStoreId: store.id, variantId: v.id, qty: 1, status: "requested", requestedBy: useTill.getState().staffId ?? "", reason: "Low stock" });
                auditHere("transfer", `Requested ${t.number}: 1 × ${v.sku} from ${from.name}`, { ref: t.number });
                toast(`${t.number} requested from ${from.name}`);
              }
              onClose();
            }}
          >
            Request transfer
          </Button>
          <Button
            variant="primary"
            icon={<PackagePlus size={16} />}
            disabled={change === 0}
            onClick={async () => {
              const who = await approvePerm("stockAdjust", "Adjust stock", "Stock changes need a supervisor or manager.");
              if (!who) return;
              if (liveMode()) {
                try {
                  await posApi.adjustStock({ warehouseId: hereKey, variantId: v.id, delta: change, reason });
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Stock adjust failed");
                  return;
                }
              }
              db.moveStock(v.id, hereKey, change);
              db.log(`${v.sku} ${change > 0 ? "+" : ""}${change} at ${store.name} (${reason})`, "stock");
              auditHere("stock", `${v.sku} ${change > 0 ? "+" : "−"}${Math.abs(change)} (${reason})`, { approvedBy: who.id, ref: v.sku, amount: Math.abs(change) * p.price });
              toast(`${v.sku} is now ${now + change} here`);
              onClose();
            }}
          >
            Save · new count {now + change}
          </Button>
        </>
      }
    >
      <div className="divide-y divide-line rounded-xl border border-line text-[13px]">
        {db.stores.map((s) => (
          <div key={s.id} className="tnum flex justify-between px-4 py-2">
            <span className={s.id === store.id ? "font-medium" : ""}>{s.name}</span>
            <span className="font-medium">{db.inventory[v.id]?.[stockKeyOf(s)] ?? db.inventory[v.id]?.[s.id] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm">Change (now {now} here)</span>
        <div className="inline-flex items-center rounded-lg border border-line">
          <button aria-label="Decrease stock change" disabled={now + change <= 0} onClick={() => setChange(change - 1)} className="h-11 w-11 text-lg disabled:opacity-30">
            −
          </button>
          <span className="tnum w-10 text-center font-semibold">{change > 0 ? `+${change}` : change}</span>
          <button aria-label="Increase stock change" onClick={() => setChange(change + 1)} className="h-11 w-11 text-lg">
            +
          </button>
        </div>
      </div>
      <Field label="Reason" className="mt-4">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

/* ---------- Stock count ---------- */

function Count() {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const counts = useDb((s) => s.counts);
  const staff = useDb((s) => s.staff);
  const { store, warehouseId } = useRegister();
  const me = useMe()!;
  const [scope, setScope] = useState<Category | "Whole store" | null>(null);
  const [pick, setPick] = useState<Category | "Whole store">("Fragrances");
  const [counted, setCounted] = useState<Record<string, number>>({});
  const [code, setCode] = useState("");
  const [diffOnly, setDiffOnly] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const stockId = warehouseId;

  const rows = useMemo(() => {
    if (!scope) return [];
    return products
      .filter((p) => scope === "Whole store" || p.category === scope)
      .flatMap((p) => p.variants.map((v) => ({ p, v, expected: inventory[v.id]?.[stockId] ?? inventory[v.id]?.[store.id] ?? 0, counted: counted[v.id] ?? 0 })));
  }, [products, inventory, stockId, store.id, scope, counted]);
  const shown = diffOnly ? rows.filter((r) => r.counted !== r.expected) : rows;
  const scanned = rows.reduce((a, r) => a + r.counted, 0);
  const expected = rows.reduce((a, r) => a + r.expected, 0);
  const missing = rows.reduce((a, r) => a + Math.max(0, r.expected - r.counted), 0);
  const extra = rows.reduce((a, r) => a + Math.max(0, r.counted - r.expected), 0);
  const value = rows.reduce((a, r) => a + (r.counted - r.expected) * r.p.price, 0);
  const myCounts = counts.filter((c) => c.storeId === stockId || c.storeId === store.id);

  const scan = () => {
    const f = lookup(products, code);
    setCode("");
    if (!f) return toast(`No item with barcode or SKU "${code.trim()}"`, "bad");
    if (!rows.some((r) => r.v.id === f.v.id)) return toast(`${f.p.name} isn't in this count (${scope})`, "bad");
    setCounted((c) => ({ ...c, [f.v.id]: (c[f.v.id] ?? 0) + 1 }));
    setLast(f.v.id);
  };

  const finish = async () => {
    const who = await approvePerm("stockAdjust", "Finish the stock count?", "The differences will be written to stock. A supervisor or manager approves.");
    if (!who) return;
    const db = useDb.getState();
    const lines = rows.filter((r) => r.counted || r.expected).map((r) => ({ variantId: r.v.id, expected: r.expected, counted: r.counted }));
    let number = "";
    if (liveMode()) {
      try {
        const created = (await posApi.createCount({ warehouseId: stockId, scope: scope!, lines })) as { id: string; number: string };
        await posApi.postCount(created.id);
        number = created.number;
        for (const r of rows) if (r.counted !== r.expected) db.moveStock(r.v.id, stockId, r.counted - r.expected);
        db.addCount({ storeId: stockId, at: new Date().toISOString(), staffId: me.id, approvedBy: who.id, scope: scope!, lines });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Could not post stock count");
        return;
      }
    } else {
      for (const r of rows) if (r.counted !== r.expected) db.moveStock(r.v.id, store.id, r.counted - r.expected);
      const c = db.addCount({ storeId: store.id, at: new Date().toISOString(), staffId: me.id, approvedBy: who.id, scope: scope!, lines });
      number = c.number;
    }
    auditHere("count", `Stock count ${number} (${scope}): ${missing} missing, ${extra} extra, ${naira(Math.abs(value))} ${value < 0 ? "short" : "over"} at retail`, { approvedBy: who.id, amount: Math.abs(value), ref: number });
    db.log(`${number} stock count at ${store.name}: ${missing} missing, ${extra} extra`, "stock");
    toast(`${number} saved. Stock updated.`);
    setScope(null);
    setCounted({});
  };

  if (!scope)
    return (
      <>
        <div className="rounded-xl border border-line bg-white p-5 shadow-card">
          <p className="font-semibold">Start a count</p>
          <p className="mt-1 text-[13px] text-muted">Scan every item on the shelf. Anything not scanned counts as missing. Do one area at a time.</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="What to count">
              <Select aria-label="What to count" value={pick} onChange={(e) => setPick(e.target.value as Category | "Whole store")} className="w-56">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option>Whole store</option>
              </Select>
            </Field>
            <Button variant="primary" icon={<ClipboardCheck size={16} />} onClick={() => (setScope(pick), setCounted({}))} data-testid="start-count">
              Start counting
            </Button>
          </div>
        </div>
        <h2 className="mb-3 mt-8 text-sm font-semibold text-muted">Past counts here</h2>
        {!myCounts.length ? (
          <Empty icon={<ClipboardCheck size={20} />} title="No counts yet" />
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line bg-white">
            {myCounts.map((c) => {
              const miss = c.lines.reduce((a, l) => a + Math.max(0, l.expected - l.counted), 0);
              const over = c.lines.reduce((a, l) => a + Math.max(0, l.counted - l.expected), 0);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="font-mono">{c.number}</span>
                  <span className="flex-1">
                    {c.scope} · {fmtDate(c.at)} · {staff.find((s) => s.id === c.staffId)?.name.split(" ")[0]}
                  </span>
                  <Badge tone={miss ? "bad" : over ? "warn" : "good"}>{miss || over ? `${miss} missing, ${over} extra` : "All matched"}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </>
    );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">Counting {scope}</Badge>
        <span className="tnum text-[13px] text-muted">
          {scanned} scanned of {expected} expected
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => (setScope(null), setCounted({}))}>
          Discard count
        </Button>
      </div>
      <div className="mt-3 flex gap-2">
        <SearchBox autoFocus value={code} onChange={setCode} onEnter={scan} placeholder="Scan a barcode or type a SKU, then Enter" className="flex-1" />
        <Button onClick={scan} disabled={!code.trim()}>
          Add
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-faint">Sample barcodes are shown on each product's dialog on the Sell screen.</p>
      <div className="tnum mt-4 grid grid-cols-3 gap-2">
        <Box label="Missing" value={missing} tone={missing ? "bad" : undefined} />
        <Box label="Extra" value={extra} tone={extra ? "warn" : undefined} />
        <Box label="Value at retail" value={`${value < 0 ? "−" : value > 0 ? "+" : ""}${naira(Math.abs(value))}`} tone={value < 0 ? "bad" : undefined} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Chip active={diffOnly} onClick={() => setDiffOnly(!diffOnly)}>
          Differences only
        </Chip>
      </div>
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {shown.map((r) => {
          const d = r.counted - r.expected;
          return (
            <div key={r.v.id} className={cx("flex items-center gap-3 px-4 py-2", last === r.v.id && "bg-gold-soft")} data-testid="count-row">
              <img src={r.p.image} alt="" className="h-10 w-8 rounded object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{r.p.name}</span>
                <span className="text-xs text-muted">
                  {label(r.v)} · {r.v.sku}
                </span>
              </span>
              <span className="tnum w-16 text-right text-xs text-muted">expect {r.expected}</span>
              <div className="inline-flex items-center rounded-lg border border-line">
                <button aria-label={`One fewer ${r.v.sku}`} disabled={!r.counted} onClick={() => setCounted({ ...counted, [r.v.id]: r.counted - 1 })} className="h-9 w-9 disabled:opacity-30">
                  −
                </button>
                <span className="tnum w-8 text-center text-sm font-semibold">{r.counted}</span>
                <button aria-label={`One more ${r.v.sku}`} onClick={() => setCounted({ ...counted, [r.v.id]: r.counted + 1 })} className="h-9 w-9">
                  +
                </button>
              </div>
              <span className={cx("tnum w-10 text-right text-sm font-semibold", d < 0 ? "text-bad" : d > 0 ? "text-warn" : "text-good")}>{d === 0 ? <Check size={16} className="ml-auto" /> : d > 0 ? `+${d}` : d}</span>
            </div>
          );
        })}
        {!shown.length && <p className="p-6 text-center text-sm text-muted">Everything matches so far.</p>}
      </div>
      <div className="sticky bottom-0 mt-4 flex justify-end border-t border-line bg-canvas py-3">
        <Button variant="primary" size="lg" icon={<ClipboardCheck size={17} />} onClick={finish} data-testid="finish-count">
          Finish count · {missing + extra} {missing + extra === 1 ? "difference" : "differences"}
        </Button>
      </div>
    </>
  );
}

function Box({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "bad" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("mt-0.5 text-lg font-semibold", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</p>
    </div>
  );
}

/* ---------- Receiving ---------- */

function Receive() {
  const deliveries = useDb((s) => s.deliveries);
  const { store, warehouseId } = useRegister();
  const [open, setOpen] = useState<string | null>(null);
  const stockId = warehouseId;
  const mine = useMemo(
    () =>
      deliveries
        .filter((d) => d.storeId === stockId || d.storeId === store.id)
        .sort((a, b) => (a.status === "received" ? 1 : 0) - (b.status === "received" ? 1 : 0) || a.expectedAt.localeCompare(b.expectedAt)),
    [deliveries, stockId, store.id],
  );
  const d = mine.find((x) => x.id === open);
  if (d) return <ReceiveOne d={d} onBack={() => setOpen(null)} />;
  if (!mine.length) return <Empty icon={<Truck size={20} />} title="No deliveries expected" body="Supplier deliveries booked in the admin show here to check in." />;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {mine.map((x) => {
        const units = x.lines.reduce((a, l) => a + l.qty, 0);
        const tone: Tone = x.status === "received" ? "good" : x.status === "partial" ? "warn" : "info";
        return (
          <button key={x.id} onClick={() => setOpen(x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas/60" data-testid="delivery-row">
            <PackageOpen size={18} className="text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">
                {x.number} · {x.supplier}
              </span>
              <span className="text-xs text-muted">
                {units} items · {x.status === "received" ? `received ${fmtDate(x.receivedAt!)}` : `expected ${fmtDate(x.expectedAt)}`}
              </span>
            </span>
            <Badge tone={tone}>{x.status === "received" ? "Received" : x.status === "partial" ? "Part received" : "Expected"}</Badge>
            <ChevronRight size={16} className="text-faint" />
          </button>
        );
      })}
    </div>
  );
}

function ReceiveOne({ d, onBack }: { d: Delivery; onBack: () => void }) {
  const products = useDb((s) => s.products);
  const me = useMe()!;
  const { store, warehouseId } = useRegister();
  const done = d.status === "received";
  const [got, setGot] = useState<Record<string, number>>(() => Object.fromEntries(d.lines.map((l) => [l.variantId, l.received])));
  const [code, setCode] = useState("");
  const total = d.lines.reduce((a, l) => a + l.qty, 0);
  const have = d.lines.reduce((a, l) => a + (got[l.variantId] ?? 0), 0);

  const scan = () => {
    const f = lookup(products, code);
    setCode("");
    if (!f || !d.lines.some((l) => l.variantId === f.v.id)) return toast(f ? `${f.v.sku} isn't on ${d.number}. Put it aside and tell the office.` : `No item with barcode or SKU "${code.trim()}"`, "bad");
    setGot((g) => ({ ...g, [f.v.id]: (g[f.v.id] ?? 0) + 1 }));
  };

  const finish = async () => {
    const db = useDb.getState();
    const added = d.lines.reduce((a, l) => a + Math.max(0, (got[l.variantId] ?? 0) - l.received), 0);
    const lines = d.lines.map((l) => ({ variantId: l.variantId, received: got[l.variantId] ?? 0 }));
    const all = d.lines.every((l) => (got[l.variantId] ?? 0) >= l.qty);
    if (liveMode()) {
      try {
        await posApi.receiveGrn(d.id, lines);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Could not receive delivery");
        return;
      }
    }
    for (const l of d.lines) {
      const n = (got[l.variantId] ?? 0) - l.received;
      if (n > 0) db.moveStock(l.variantId, warehouseId, n);
    }
    db.patchDelivery(d.id, { lines: d.lines.map((l) => ({ ...l, received: got[l.variantId] ?? 0 })), status: all ? "received" : "partial", receivedAt: new Date().toISOString(), receivedBy: me.id });
    auditHere("stock", `Received ${d.number} from ${d.supplier}: ${added} items${all ? "" : `, ${total - have} short`}`, { ref: d.number });
    db.log(`${d.number} from ${d.supplier} received at ${store.name}`, "stock");
    toast(all ? `${d.number} received. ${added} items added to stock.` : `${added} items added. ${d.number} is marked part received.`);
    onBack();
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={onBack}>
        ← All deliveries
      </Button>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold">
          {d.number} · {d.supplier}
        </h2>
        <span className="tnum text-[13px] text-muted">
          {have} of {total} items
        </span>
      </div>
      {!done && (
        <div className="mt-3 flex gap-2">
          <SearchBox autoFocus value={code} onChange={setCode} onEnter={scan} placeholder="Scan each item as you unpack it" className="flex-1" />
          <Button onClick={() => setGot(Object.fromEntries(d.lines.map((l) => [l.variantId, l.qty])))}>Receive all</Button>
        </div>
      )}
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {d.lines.map((l) => {
          const f = findVariant(products, l.variantId);
          const n = got[l.variantId] ?? 0;
          return (
            <div key={l.variantId} className="flex items-center gap-3 px-4 py-2.5" data-testid="receive-line">
              {f && <img src={f.product.image} alt="" className="h-10 w-8 rounded object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{f?.product.name}</span>
                <span className="text-xs text-muted">
                  {f && label(f.variant)} · {f?.variant.sku} · {f?.variant.barcode}
                </span>
              </span>
              {!done && (
                <div className="inline-flex items-center rounded-lg border border-line">
                  <button aria-label="One fewer" disabled={n <= l.received} onClick={() => setGot({ ...got, [l.variantId]: n - 1 })} className="h-9 w-9 disabled:opacity-30">
                    −
                  </button>
                  <button aria-label="One more" onClick={() => setGot({ ...got, [l.variantId]: n + 1 })} className="h-9 w-9">
                    <Plus size={14} className="mx-auto" />
                  </button>
                </div>
              )}
              <span className={cx("tnum w-14 text-right text-sm font-semibold", n >= l.qty ? "text-good" : n > 0 ? "text-warn" : "text-muted")}>
                {n}/{l.qty}
              </span>
            </div>
          );
        })}
      </div>
      {!done && (
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="lg" icon={<Check size={17} />} disabled={have === d.lines.reduce((a, l) => a + l.received, 0)} onClick={finish} data-testid="finish-receive">
            {have >= total ? "Finish · all received" : `Finish · ${total - have} short`}
          </Button>
        </div>
      )}
    </>
  );
}

/* ---------- Transfers ---------- */

const T_LABEL: Record<Transfer["status"], [string, Tone]> = {
  requested: ["Waiting for approval", "warn"],
  approved: ["Approved, to pack", "info"],
  "in-transit": ["On the way", "gold"],
  received: ["Received", "good"],
  rejected: ["Turned down", "bad"],
};

function Transfers() {
  const transfers = useDb((s) => s.transfers);
  const { store, warehouseId } = useRegister();
  const [asking, setAsking] = useState(false);
  const stockId = warehouseId;
  const incoming = useMemo(() => transfers.filter((t) => t.toStoreId === stockId || t.toStoreId === store.id), [transfers, stockId, store.id]);
  const outgoing = useMemo(() => transfers.filter((t) => t.fromStoreId === stockId || t.fromStoreId === store.id), [transfers, stockId, store.id]);
  return (
    <>
      <div className="flex items-center">
        <p className="flex-1 text-[13px] text-muted">Head office approves requests in the admin. Stock leaves the sender when it's sent and arrives here when you receive it.</p>
        <Button variant="primary" icon={<ArrowLeftRight size={16} />} onClick={() => setAsking(true)} data-testid="request-stock">
          Request stock
        </Button>
      </div>
      <h2 className="mb-2 mt-6 text-sm font-semibold">Coming here</h2>
      <TransferList list={incoming} dir="in" />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Going out</h2>
      <TransferList list={outgoing} dir="out" />
      {asking && <RequestDialog onClose={() => setAsking(false)} />}
    </>
  );
}

function TransferList({ list, dir }: { list: Transfer[]; dir: "in" | "out" }) {
  const products = useDb((s) => s.products);
  const stores = useDb((s) => s.stores);
  const staff = useDb((s) => s.staff);
  const me = useMe()!;
  if (!list.length) return <p className="rounded-xl border border-dashed border-line-strong p-5 text-center text-[13px] text-muted">No transfers {dir === "in" ? "coming here" : "going out"}.</p>;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {list.map((t) => {
        const f = findVariant(products, t.variantId);
        const other = stores.find((s) => s.id === (dir === "in" ? t.fromStoreId : t.toStoreId));
        const [txt, tone] = T_LABEL[t.status];
        const step = async (status: Transfer["status"], msg: string) => {
          if (liveMode()) {
            try {
              await posApi.stepTransfer(t.id, status);
            } catch (e) {
              toast(e instanceof ApiError ? e.message : "Transfer update failed");
              return;
            }
          }
          useDb.getState().stepTransfer(t.id, status, me.id);
          auditHere("transfer", `${t.number} ${status === "received" ? "received" : "sent"}: ${t.qty} × ${f?.variant.sku}`, { ref: t.number });
          toast(msg);
        };
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`transfer-${dir}`}>
            {f && <img src={f.product.image} alt="" className="h-11 w-9 rounded object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">
                {t.qty} × {f?.product.name} <span className="font-normal text-muted">· {f && label(f.variant)}</span>
              </span>
              <span className="text-xs text-muted">
                <span className="font-mono">{t.number}</span> · {dir === "in" ? "from" : "to"} {other?.name} · asked by {staff.find((s) => s.id === t.requestedBy)?.name.split(" ")[0]} {fmtTime(t.at)}
                {t.reason && ` · ${t.reason}`}
              </span>
            </span>
            <Badge tone={tone}>{txt}</Badge>
            {dir === "out" && t.status === "approved" && (
              <Button size="sm" variant="primary" icon={<Send size={14} />} onClick={() => step("in-transit", `${t.number} sent to ${other?.name}`)}>
                Pack and send
              </Button>
            )}
            {dir === "in" && t.status === "in-transit" && (
              <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => step("received", `${t.qty} × ${f?.variant.sku} added to stock here`)} data-testid="receive-transfer">
                Receive
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const stores = useDb((s) => s.stores);
  const { store, warehouseId } = useRegister();
  const me = useMe()!;
  const [q, setQ] = useState("");
  const [p, setP] = useState<Product | null>(null);
  const [colour, setColour] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [from, setFrom] = useState("");
  const [reason, setReason] = useState("Low stock");
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((x) => x.name.toLowerCase().includes(t) || x.brand.toLowerCase().includes(t) || x.variants.some((v) => v.sku.toLowerCase().includes(t))).slice(0, 8) : [];
  }, [products, q]);
  const v = p?.variants.find((x) => x.colour === colour && x.size === size);
  const at = (sid: string) => {
    if (!v) return 0;
    const storeRow = stores.find((s) => s.id === sid);
    const key = storeRow ? stockKeyOf(storeRow) : sid;
    return inventory[v.id]?.[key] ?? inventory[v.id]?.[sid] ?? 0;
  };
  const sources = stores.filter((s) => stockKeyOf(s) !== warehouseId && s.id !== store.id);

  const choose = (x: Product) => {
    setP(x);
    setColour(x.colours[0].name);
    setSize(x.sizes.length === 1 ? x.sizes[0] : "");
    setFrom("");
  };

  return (
    <Dialog
      title="Request stock from another location"
      sub="Goes to head office to approve, then the sender packs it."
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!v || !from || qty < 1 || at(from) < qty}
          onClick={async () => {
            const src = stores.find((s) => s.id === from)!;
            if (liveMode()) {
              try {
                const t = (await posApi.createTransfer({
                  fromWarehouseId: stockKeyOf(src),
                  toWarehouseId: warehouseId,
                  variantId: v!.id,
                  qty,
                  reason,
                })) as { number: string };
                auditHere("transfer", `Requested ${t.number}: ${qty} × ${v!.sku} from ${src.name}`, { ref: t.number });
                useDb.getState().log(`${t.number} requested by ${store.name} from ${src.name}`, "stock");
                toast(`${t.number} requested from ${src.name}`);
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Transfer request failed");
                return;
              }
            } else {
              const t = useDb.getState().addTransfer({ id: uid(), at: new Date().toISOString(), fromStoreId: from, toStoreId: store.id, variantId: v!.id, qty, status: "requested", requestedBy: me.id, reason });
              auditHere("transfer", `Requested ${t.number}: ${qty} × ${v!.sku} from ${src.name}`, { ref: t.number });
              useDb.getState().log(`${t.number} requested by ${store.name} from ${src.name}`, "stock");
              toast(`${t.number} requested from ${src.name}`);
            }
            onClose();
          }}
          data-testid="send-request"
        >
          Send request
        </Button>
      }
    >
      {!p ? (
        <>
          <SearchBox autoFocus value={q} onChange={setQ} placeholder="Search by name, brand or SKU" />
          <ul className="mt-3 divide-y divide-line">
            {matches.map((x) => (
              <li key={x.id}>
                <button onClick={() => choose(x)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-canvas">
                  <img src={x.image} alt="" className="h-11 w-9 rounded object-cover" />
                  <span className="text-[13.5px] font-medium">{x.name}</span>
                  <span className="ml-auto text-xs text-muted">{x.brand}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <img src={p.image} alt="" className="h-14 w-11 rounded object-cover" />
            <span className="flex-1 font-medium">{p.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setP(null)}>
              Change
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Colour">
              <Select aria-label="Colour" value={colour} onChange={(e) => setColour(e.target.value)}>
                {p.colours.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Size">
              <Select aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">Choose</option>
                {p.sizes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input aria-label="Quantity" inputMode="numeric" className="tnum" value={String(qty)} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)} />
            </Field>
          </div>
          {v && (
            <>
              <p className="mb-2 mt-4 text-[13px] font-medium text-ink-2">Send from</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sources.map((s) => (
                  <button key={s.id} aria-pressed={from === s.id} disabled={at(s.id) === 0} onClick={() => setFrom(s.id)} className={cx("flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] disabled:opacity-40", from === s.id ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas")}>
                    <span>{s.name}</span>
                    <span className="tnum font-semibold">{at(s.id)} in stock</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <Field label="Reason" className="mt-4">
            <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Low stock", "Customer waiting", "Customer order", "Window display", "Rebalancing"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </>
      )}
    </Dialog>
  );
}
