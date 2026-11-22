import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, PackageCheck, Truck, X } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { adminPosApi, posApi } from "../api/pos";
import { findVariant, useDb } from "../data/store";
import type { Transfer } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Empty, Segmented, Select, Stat, cx, fmtDate, fmtTime, toast, type Tone } from "../ui/kit";
import { PageHead, Td, Th } from "./Admin";

type Tab = "transfers" | "deliveries" | "counts";

const T_STATUS: Record<Transfer["status"], [string, Tone]> = {
  requested: ["Waiting for approval", "warn"],
  approved: ["Approved, to pack", "info"],
  "in-transit": ["On the way", "gold"],
  received: ["Received", "good"],
  rejected: ["Rejected", "neutral"],
};
const STEP_LABEL: Record<Transfer["status"], string> = { requested: "Requested", approved: "Approved", "in-transit": "Shipped", received: "Received", rejected: "Rejected" };

/** The admin is signed in as Temi (manager) in the prototype. */
const ADMIN_ID = "s1";

type StockMovesApi = { transfers: ApiTransfer[]; counts: ApiCount[]; grn: ApiGrn[] };
type ApiTransfer = {
  id: string;
  number: string;
  createdAt: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  variantId: string;
  qty: number;
  status: Transfer["status"];
  reason: string | null;
  steps: { status: Transfer["status"]; at: string; by: string; note?: string }[];
};
type ApiCount = { id: string; number: string; warehouseId: string; at: string; staffId: string; approvedById: string | null; scope: string; lines: { variantId: string; expected: number; counted: number }[] };
type ApiGrn = { id: string; number: string; supplier: string; warehouseId: string; expectedAt: string; status: string; receivedAt: string | null; receivedById: string | null; lines: { variantId: string; qty: number; received: number }[] };

export default function StockMoves() {
  const [tab, setTab] = useState<Tab>("transfers");
  const live = liveMode();
  const transfers = useDb((s) => s.transfers);
  const deliveries = useDb((s) => s.deliveries);
  const counts = useDb((s) => s.counts);
  const stores = useDb((s) => s.stores);
  const [remote, setRemote] = useState<StockMovesApi | null>(null);
  const [warehouseNames, setWarehouseNames] = useState<Map<string, string>>(new Map());

  const loadRemote = useCallback(() => {
    if (!live) return;
    adminPosApi
      .stockMoves()
      .then((m) => setRemote(m as StockMovesApi))
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load stock movements"));
  }, [live]);

  useEffect(() => {
    loadRemote();
  }, [loadRemote]);

  useEffect(() => {
    if (!live) return;
    adminPosApi
      .warehouses()
      .then((rows) => {
        const m = new Map<string, string>();
        for (const w of rows as { id: string; name: string }[]) m.set(w.id, w.name);
        for (const s of stores) {
          if (s.warehouseId) m.set(s.warehouseId, s.name);
          m.set(s.id, s.name);
        }
        setWarehouseNames(m);
      })
      .catch(() => undefined);
  }, [live, stores]);

  const placeName = (id: string) => stores.find((s) => s.id === id || s.warehouseId === id)?.name ?? warehouseNames.get(id) ?? (live ? "…" : id);

  return (
    <>
      <PageHead title="Stock movements" sub="Transfers between stores and the warehouse, supplier deliveries checked in at the tills, and stock counts. Every move updates Inventory." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Transfers to approve" value={(live && remote ? remote.transfers : transfers).filter((t) => t.status === "requested").length} />
        <Stat label="On the way" value={(live && remote ? remote.transfers : transfers).filter((t) => t.status === "in-transit").length} />
        <Stat label="Deliveries expected" value={(live && remote ? remote.grn : deliveries).filter((d) => d.status !== "received").length} />
        <Stat label="Counts this month" value={(live && remote ? remote.counts : counts).filter((c) => new Date(c.at).getMonth() === new Date().getMonth()).length} />
      </div>
      <div className="mb-4 mt-6">
        <Segmented value={tab} onChange={setTab} options={[{ value: "transfers", label: "Transfers" }, { value: "deliveries", label: "Deliveries" }, { value: "counts", label: "Stock counts" }]} />
      </div>
      {tab === "transfers" && <Transfers live={live} remote={remote?.transfers} onRefresh={loadRemote} placeName={placeName} />}
      {tab === "deliveries" && <Deliveries live={live} grn={remote?.grn} placeName={placeName} />}
      {tab === "counts" && <Counts live={live} remote={remote?.counts} placeName={placeName} />}
    </>
  );
}

function apiToTransfer(t: ApiTransfer): Transfer {
  return {
    id: t.id,
    number: t.number,
    at: typeof t.createdAt === "string" ? t.createdAt : new Date(t.createdAt).toISOString(),
    fromStoreId: t.fromWarehouseId,
    toStoreId: t.toWarehouseId,
    variantId: t.variantId,
    qty: t.qty,
    status: t.status,
    reason: t.reason ?? undefined,
    requestedBy: t.steps[0]?.by ?? "",
    steps: (t.steps ?? []).map((s) => ({ status: s.status, at: s.at, by: s.by })),
  };
}

function Transfers({ live, remote, onRefresh, placeName }: { live: boolean; remote?: ApiTransfer[]; onRefresh: () => void; placeName: (id: string) => string }) {
  const transfers = useDb((s) => s.transfers);
  const products = useDb((s) => s.products);
  const staff = useDb((s) => s.staff);
  const inventory = useDb((s) => s.inventory);
  const step = useDb((s) => s.stepTransfer);
  const audit = useDb((s) => s.audit);
  const [status, setStatus] = useState("open");
  const liveRows = useMemo(() => (remote ?? []).map((t) => apiToTransfer(t)), [remote]);
  const source = live ? liveRows : transfers;
  const rows = useMemo(() => source.filter((t) => (status === "all" ? true : status === "open" ? t.status !== "received" && t.status !== "rejected" : t.status === status)), [source, status]);
  const storeName = placeName;
  const first = (id: string) => staff.find((s) => s.id === id)?.name?.split(" ")[0] ?? (typeof id === "string" && !id.startsWith("s") ? id.split(" ")[0] : id);

  const move = async (t: Transfer, to: Transfer["status"], msg: string) => {
    if (live) {
      try {
        await posApi.stepTransfer(t.id, to);
        toast(msg);
        onRefresh();
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Transfer update failed");
      }
      return;
    }
    step(t.id, to, ADMIN_ID);
    audit({ action: "transfer", staffId: ADMIN_ID, storeId: to === "received" ? t.toStoreId : t.fromStoreId, text: `${t.number} ${STEP_LABEL[to].toLowerCase()}: ${t.qty} × ${findVariant(products, t.variantId)?.variant.sku} ${storeName(t.fromStoreId)} → ${storeName(t.toStoreId)}`, ref: t.number });
    toast(msg);
  };

  return (
    <>
      <div className="mb-3">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="open">Open</option>
          <option value="requested">Waiting for approval</option>
          <option value="in-transit">On the way</option>
          <option value="received">Received</option>
          <option value="all">All</option>
        </Select>
      </div>
      {!rows.length && <Empty icon={<Truck size={20} />} title="No transfers here" body="Stores request stock from each other at the till." />}
      <div className="space-y-3">
        {rows.map((t) => {
          const f = findVariant(products, t.variantId);
          const [label, tone] = T_STATUS[t.status];
          const atSource = live ? 999 : inventory[t.variantId]?.[t.fromStoreId] ?? 0;
          return (
            <div key={t.id} className="rounded-xl border border-line bg-white p-4 shadow-card" data-testid="transfer-card">
              <div className="flex flex-wrap items-start gap-4">
                {f && <img src={f.product.image} alt="" className="h-14 w-11 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.qty} × {f?.product.name} <span className="font-normal text-muted">· {f && `${f.variant.colour} ${f.variant.size !== "One Size" ? f.variant.size : ""}`}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                    <span className="font-medium text-ink">{storeName(t.fromStoreId)}</span>
                    <ArrowRight size={13} />
                    <span className="font-medium text-ink">{storeName(t.toStoreId)}</span>
                    <span>
                      · {t.number} · {f?.variant.sku}
                    </span>
                  </p>
                  {t.reason && <p className="mt-1 text-[13px]">{t.reason}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={tone} dot>
                    {label}
                  </Badge>
                  {t.status === "requested" && <span className="text-xs text-muted">{atSource} in stock at {storeName(t.fromStoreId)}</span>}
                </div>
              </div>
              <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-xs">
                {t.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className={cx("flex h-5 w-5 items-center justify-center rounded-full", s.status === "rejected" ? "bg-bad-soft text-bad" : "bg-good-soft text-good")}>{s.status === "rejected" ? <X size={11} /> : <Check size={11} />}</span>
                    <span className="font-medium">{STEP_LABEL[s.status]}</span>
                    <span className="text-muted">
                      {first(s.by)} · {fmtDate(s.at)} {fmtTime(s.at)}
                    </span>
                  </li>
                ))}
              </ol>
              {t.status !== "received" && t.status !== "rejected" && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {t.status === "requested" && (
                    <>
                      <Button size="sm" variant="ghost" icon={<X size={15} />} onClick={() => move(t, "rejected", `${t.number} rejected. The store is told at the till.`)}>
                        Reject
                      </Button>
                      <Button size="sm" variant="primary" icon={<Check size={15} />} disabled={atSource < t.qty} onClick={() => move(t, "approved", `${t.number} approved. ${storeName(t.fromStoreId)} will pack it.`)}>
                        Approve
                      </Button>
                    </>
                  )}
                  {t.status === "approved" && (
                    <Button size="sm" variant="primary" icon={<Truck size={15} />} onClick={() => move(t, "in-transit", `${t.number} marked as shipped. Stock has left ${storeName(t.fromStoreId)}.`)}>
                      Mark shipped
                    </Button>
                  )}
                  {t.status === "in-transit" && (
                    <Button size="sm" variant="primary" icon={<PackageCheck size={15} />} onClick={() => move(t, "received", `${t.number} received at ${storeName(t.toStoreId)}`)}>
                      Mark received
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Stock leaves the sending store when the transfer is shipped and arrives when it's received. Stores usually ship and receive from the till by scanning.</p>
    </>
  );
}

function Deliveries({ live, grn, placeName }: { live: boolean; grn?: ApiGrn[]; placeName: (id: string) => string }) {
  const deliveries = useDb((s) => s.deliveries);
  const products = useDb((s) => s.products);
  const staff = useDb((s) => s.staff);
  const rows = live
    ? (grn ?? []).map((d) => ({
        id: d.id,
        number: d.number,
        supplier: d.supplier,
        storeId: d.warehouseId,
        status: d.status === "received" ? ("received" as const) : d.status === "partial" ? ("partial" as const) : ("expected" as const),
        expectedAt: d.expectedAt,
        receivedAt: d.receivedAt ?? undefined,
        receivedBy: d.receivedById ?? undefined,
        lines: d.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, received: l.received })),
      }))
    : deliveries;
  if (!rows.length) return <Empty icon={<Truck size={20} />} title="No deliveries" />;
  return (
    <div className="space-y-3">
      {rows.map((d) => {
        const qty = d.lines.reduce((a, l) => a + l.qty, 0);
        const got = d.lines.reduce((a, l) => a + l.received, 0);
        return (
          <div key={d.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <div className="flex-1">
                <p className="font-medium">
                  {d.number} · {d.supplier}
                </p>
                <p className="text-[13px] text-muted">
                  To {placeName(d.storeId)} · {d.status === "received" ? `received ${fmtDate(d.receivedAt!)} by ${staff.find((s) => s.id === d.receivedBy)?.name.split(" ")[0] ?? ""}` : `expected ${fmtDate(d.expectedAt)}`}
                </p>
              </div>
              <span className="tnum text-[13px] text-muted">
                {got} of {qty} units
              </span>
              <Badge tone={d.status === "received" ? "good" : d.status === "partial" ? "warn" : "info"} dot>
                {d.status === "received" ? "Received" : d.status === "partial" ? "Part received" : "Expected"}
              </Badge>
            </div>
            <table className="tnum w-full text-[13px]">
              <tbody className="divide-y divide-line">
                {d.lines.map((l) => {
                  const f = findVariant(products, l.variantId);
                  return (
                    <tr key={l.variantId}>
                      <Td>
                        {f?.product.name} <span className="text-muted">· {f && `${f.variant.colour} ${f.variant.size !== "One Size" ? f.variant.size : ""}`}</span>
                      </Td>
                      <Td className="text-muted">{f?.variant.sku}</Td>
                      <Td right className={cx("font-medium", l.received < l.qty && d.status !== "expected" && "text-warn")}>
                        {l.received} / {l.qty}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Counts({ live, remote, placeName }: { live: boolean; remote?: ApiCount[]; placeName: (id: string) => string }) {
  const counts = useDb((s) => s.counts);
  const products = useDb((s) => s.products);
  const staff = useDb((s) => s.staff);
  const rows = live
    ? (remote ?? []).map((c) => ({
        id: c.id,
        number: c.number,
        storeId: c.warehouseId,
        staffId: c.staffId,
        approvedBy: c.approvedById ?? undefined,
        at: typeof c.at === "string" ? c.at : new Date(c.at).toISOString(),
        scope: c.scope,
        lines: c.lines,
      }))
    : counts;
  const [open, setOpen] = useState<string | null>(rows[0]?.id ?? null);
  if (!rows.length) return <Empty icon={<ClipboardCheck size={20} />} title="No counts yet" body="Stores count stock at the till by scanning shelves." />;
  const name = (id?: string) => staff.find((s) => s.id === id)?.name.split(" ")[0];
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
      <table className="tnum w-full text-[13px]">
        <thead className="border-b border-line bg-canvas/60">
          <tr>
            <Th>Count</Th>
            <Th>Store</Th>
            <Th>Counted by</Th>
            <Th right>Items</Th>
            <Th right>Difference</Th>
            <Th right>Value at retail</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((c) => {
            const diff = c.lines.reduce((a, l) => a + l.counted - l.expected, 0);
            const value = c.lines.reduce((a, l) => a + (l.counted - l.expected) * (findVariant(products, l.variantId)?.product.price ?? 0), 0);
            const expanded = open === c.id;
            return [
              <tr key={c.id} onClick={() => setOpen(expanded ? null : c.id)} className="cursor-pointer hover:bg-canvas/60">
                <Td>
                  <span className="block font-medium">
                    {c.number} · {c.scope}
                  </span>
                  <span className="text-xs text-muted">{fmtDate(c.at)}</span>
                </Td>
                <Td>{placeName(c.storeId)}</Td>
                <Td>
                  {name(c.staffId)}
                  {c.approvedBy && <span className="block text-xs text-muted">Approved by {name(c.approvedBy)}</span>}
                </Td>
                <Td right>{c.lines.length}</Td>
                <Td right className={cx("font-medium", diff < 0 ? "text-bad" : diff > 0 ? "text-good" : "")}>
                  {diff > 0 ? `+${diff}` : diff}
                </Td>
                <Td right className={cx("font-medium", value < 0 ? "text-bad" : "")}>
                  {naira(value)}
                </Td>
              </tr>,
              expanded && (
                <tr key={`${c.id}-lines`}>
                  <td colSpan={6} className="bg-canvas/40 px-4 py-3">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-muted">
                          <th className="py-1 text-left font-medium">Item</th>
                          <th className="py-1 text-right font-medium">Expected</th>
                          <th className="py-1 text-right font-medium">Counted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.lines.map((l) => {
                          const f = findVariant(products, l.variantId);
                          return (
                            <tr key={l.variantId}>
                              <td className="py-1">
                                {f?.product.name} <span className="text-muted">· {f?.variant.sku}</span>
                              </td>
                              <td className="py-1 text-right">{l.expected}</td>
                              <td className={cx("py-1 text-right font-medium", l.counted < l.expected ? "text-bad" : l.counted > l.expected ? "text-good" : "")}>{l.counted}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
