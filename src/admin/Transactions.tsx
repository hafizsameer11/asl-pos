import { useEffect, useMemo, useState } from "react";
import { CloudOff, Download, ReceiptText } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { useDb } from "../data/store";
import type { Order } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, ChannelBadge, Empty, SearchBox, Select, Sheet, StatusBadge, fmtDate, fmtTime, toast, Row } from "../ui/kit";
import { METHOD, Receipt, ReturnSlip } from "../shared/Receipt";
import { PageHead, Td, Th } from "./Admin";

type TxRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  placedAt: string;
  locationId: string | null;
  registerId: string | null;
  cashierId: string | null;
  customer: { name: string } | null;
  payments: { method: string; amount: number }[];
};

export default function Transactions() {
  const db = useDb();
  const live = liveMode();
  const [q, setQ] = useState("");
  const [store, setStore] = useState("all");
  const [staff, setStaff] = useState("all");
  const [range, setRange] = useState("7");
  const [channel, setChannel] = useState("pos");
  const [open, setOpen] = useState<Order | null>(null);
  const [openTx, setOpenTx] = useState<TxRow | null>(null);
  const [remoteRows, setRemoteRows] = useState<TxRow[]>([]);
  useEffect(() => {
    if (!live) return;
    const term = q.trim();
    const timer = window.setTimeout(() => {
      adminPosApi
        .transactions({ page: 1, pageSize: 120, q: term || undefined, locationId: store === "all" ? undefined : store })
        .then((rows) => setRemoteRows((rows as TxRow[]).map((r) => ({ ...r, total: fromKobo(r.total), payments: r.payments.map((p) => ({ ...p, amount: fromKobo(p.amount) })) }))))
        .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load transactions"));
    }, term ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [live, q, store]);

  const rows = useMemo(() => {
    if (live) {
      return remoteRows.filter((o) => staff === "all" || o.cashierId === staff);
    }
    const term = q.trim().toLowerCase();
    const since = range === "all" ? 0 : range === "today" ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(range) * 86400e3;
    return db.orders.filter(
      (o) =>
        (channel === "all" || (channel === "pos" ? o.channel === "pos" : o.channel !== "pos")) &&
        (store === "all" || o.storeId === store || o.pickupStoreId === store) &&
        (staff === "all" || o.staffId === staff) &&
        new Date(o.createdAt).getTime() >= since &&
        (!term || o.number.toLowerCase().includes(term) || o.customerName?.toLowerCase().includes(term) || o.lines.some((l) => l.sku.toLowerCase().includes(term))),
    );
  }, [db.orders, q, store, staff, range, channel, live, remoteRows]);

  const total = live
    ? (rows as TxRow[]).reduce((a, o) => a + o.total, 0)
    : (rows as Order[]).filter((o) => o.synced).reduce((a, o) => a + o.total, 0);

  return (
    <>
      <PageHead
        title="Transactions"
        sub="Every sale, return and exchange rung up at a till. They also appear in Orders with the channel set to In store."
        actions={
          <Button icon={<Download size={16} />} onClick={() => toast(`Exported ${rows.length} transactions to CSV`)}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Order, customer or SKU" className="w-full sm:w-72" />
        {!live && (
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-auto" aria-label="Channel">
            <option value="pos">In store only</option>
            <option value="online">Online only</option>
            <option value="all">All channels</option>
          </Select>
        )}
        <Select value={store} onChange={(e) => setStore(e.target.value)} className="w-auto" aria-label="Store">
          <option value="all">All stores</option>
          {db.stores
            .filter((s) => s.sellsInPerson)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <Select value={staff} onChange={(e) => setStaff(e.target.value)} className="w-auto" aria-label="Staff">
          <option value="all">All staff</option>
          {db.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {!live && (
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-auto" aria-label="Date range">
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All time</option>
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 text-[13px] text-muted">
          <span>{rows.length} transactions</span>
          <span className="tnum">
            Total <b className="text-ink">{naira(total)}</b>
          </span>
        </div>
        <div className="thin-scroll overflow-x-auto">
          <table className="tnum w-full min-w-[820px] text-sm">
            <thead className="bg-canvas/60">
              <tr>
                <Th>Order</Th>
                <Th>Date</Th>
                <Th>Channel</Th>
                <Th>Store · till</Th>
                <Th>Staff</Th>
                <Th>Customer</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {live
                ? (rows as TxRow[]).map((o) => {
                    const st = db.stores.find((x) => x.id === o.locationId);
                    const reg = db.registers.find((r) => r.id === o.registerId);
                    return (
                      <tr key={o.id} onClick={() => setOpenTx(o)} className="cursor-pointer hover:bg-canvas/70">
                        <Td className="font-medium">{o.number}</Td>
                        <Td className="text-muted">
                          {fmtDate(o.placedAt)}, {fmtTime(o.placedAt)}
                        </Td>
                        <Td>
                          <ChannelBadge channel="pos" />
                        </Td>
                        <Td>{st ? `${st.name}${reg ? ` · ${reg.name}` : ""}` : "In store"}</Td>
                        <Td>{db.staff.find((s) => s.id === o.cashierId)?.name.split(" ")[0] ?? "—"}</Td>
                        <Td>{o.customer?.name ?? <span className="text-muted">Walk-in</span>}</Td>
                        <Td className="text-muted">
                          {o.payments.map((p) => METHOD[p.method as keyof typeof METHOD] ?? p.method).join(" + ") || "—"}
                        </Td>
                        <Td>
                          <StatusBadge status={o.status as Order["status"]} />
                        </Td>
                        <Td right className="font-medium">
                          {naira(o.total)}
                        </Td>
                      </tr>
                    );
                  })
                : (rows as Order[]).slice(0, 120).map((o) => {
                    const st = db.stores.find((x) => x.id === (o.storeId ?? o.pickupStoreId));
                    const reg = db.registers.find((r) => r.id === o.registerId);
                    return (
                      <tr key={o.id} onClick={() => setOpen(o)} className="cursor-pointer hover:bg-canvas/70">
                        <Td className="font-medium">
                          <span className="flex items-center gap-2">
                            {o.number}
                            {!o.synced && (
                              <Badge tone="warn">
                                <CloudOff size={12} />
                                Not synced
                              </Badge>
                            )}
                          </span>
                        </Td>
                        <Td className="text-muted">
                          {fmtDate(o.createdAt)}, {fmtTime(o.createdAt)}
                        </Td>
                        <Td>
                          <ChannelBadge channel={o.channel} />
                        </Td>
                        <Td>{st ? `${st.name}${reg ? ` · ${reg.name}` : ""}` : "Online"}</Td>
                        <Td>{db.staff.find((s) => s.id === o.staffId)?.name.split(" ")[0] ?? "—"}</Td>
                        <Td>{o.customerName ?? <span className="text-muted">Walk-in</span>}</Td>
                        <Td className="text-muted">{o.payments.map((p) => METHOD[p.method]).join(" + ") || "Credit"}</Td>
                        <Td>
                          <StatusBadge status={o.status} />
                        </Td>
                        <Td right className="font-medium">
                          {naira(o.total)}
                        </Td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty icon={<ReceiptText size={20} />} title="No transactions match" body="Try a wider date range or clear the filters." />}
        </div>
      </div>

      {open && <OrderSheet order={db.orders.find((o) => o.id === open.id) ?? open} onClose={() => setOpen(null)} />}
      {openTx && <TxSheet tx={openTx} onClose={() => setOpenTx(null)} />}
    </>
  );
}

function TxSheet({ tx, onClose }: { tx: TxRow; onClose: () => void }) {
  const db = useDb();
  return (
    <Sheet title={tx.number} sub={`${fmtDate(tx.placedAt)}, ${fmtTime(tx.placedAt)}`} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          <ChannelBadge channel="pos" />
          <StatusBadge status={tx.status as Order["status"]} />
        </div>
        <div className="space-y-1.5 rounded-lg bg-canvas p-4 text-[13px]">
          <Row label="Payments" value={tx.payments.map((p) => `${METHOD[p.method as keyof typeof METHOD] ?? p.method} ${naira(p.amount)}`).join(", ") || "—"} />
          <Row label="Customer" value={tx.customer?.name ?? "Walk-in"} />
          <Row label="Staff" value={db.staff.find((s) => s.id === tx.cashierId)?.name ?? "—"} />
          <Row label="Total" value={naira(tx.total)} />
        </div>
      </div>
    </Sheet>
  );
}

function OrderSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const db = useDb();
  return (
    <Sheet title={order.number} sub={`${fmtDate(order.createdAt)}, ${fmtTime(order.createdAt)}`} onClose={onClose}>
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          <ChannelBadge channel={order.channel} />
          <StatusBadge status={order.status} />
          {order.synced ? <Badge tone="good">Synced</Badge> : <Badge tone="warn">Waiting for till to reconnect</Badge>}
        </div>
        <div className="space-y-1.5 rounded-lg bg-canvas p-4 text-[13px]">
          <Row label="Payments" value={order.payments.map((p) => `${METHOD[p.method]} ${naira(p.amount)}`).join(", ") || "—"} />
          <Row label="Discounts" value={naira(order.discountTotal)} />
          <Row label="Points earned" value={order.pointsEarned.toLocaleString()} />
          <Row label="Staff" value={db.staff.find((s) => s.id === order.staffId)?.name ?? "—"} />
        </div>
        <Receipt order={order} />
        {order.returns.map((r) => (
          <ReturnSlip key={r.id} order={order} ret={r} />
        ))}
      </div>
    </Sheet>
  );
}
