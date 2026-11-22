import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, Check, CreditCard, Landmark, MapPin, Phone, Plus, Printer, Scissors, Truck, Wallet, X } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import type { Alteration, Order, PayMethod } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Dialog, Empty, Field, Input, Segmented, cx, fmtDate, toast, type Tone } from "../ui/kit";
import { METHOD } from "../shared/Receipt";
import { AlterationDialog } from "./AlterationDialog";
import { approvePerm, cancelReservation, settleReservation, useMe, useRegister } from "./common";
import { navigate } from "./Till";

type Tab = "layaway" | "alterations" | "deliveries";

const daysFrom = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400e3);
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });

function shipUiStatus(status: string): "processing" | "dispatched" | "delivered" {
  if (status === "delivered") return "delivered";
  if (status === "shipped" || status === "out_for_delivery") return "dispatched";
  return "processing";
}

function saleRowToOrder(r: any): Order {
  const addr = (r.shippingAddress ?? {}) as { fullName?: string; phone?: string; address?: string; city?: string; state?: string };
  const lay = r.layaway;
  return {
    id: r.id,
    number: r.number,
    channel: "pos",
    storeId: r.locationId ?? undefined,
    registerId: r.registerId ?? undefined,
    staffId: r.cashierId ?? undefined,
    customerId: r.customer?.id,
    customerName: r.customer?.name,
    lines: (r.items ?? []).map((i: any) => ({
      productId: i.productId ?? "",
      variantId: i.variantId ?? "",
      name: i.name,
      brand: i.brand ?? "",
      image: i.imageUrl ?? i.image ?? "",
      variantLabel: [i.size, i.color].filter(Boolean).join(" / "),
      sku: i.sku ?? "",
      qty: i.qty,
      unitPrice: fromKobo(i.unitPrice ?? 0),
      lineDiscount: fromKobo(i.lineDiscount ?? 0),
      net: fromKobo(i.lineTotal ?? i.net ?? 0),
      returnedQty: i.qtyReturned ?? i.returnedQty ?? 0,
    })),
    subtotal: fromKobo(r.subtotal ?? r.total ?? 0),
    discountTotal: fromKobo(r.discount ?? 0),
    total: fromKobo(r.total ?? 0),
    vat: fromKobo(r.taxIncluded ?? 0),
    payments: (r.payments ?? []).map((p: any) => ({ method: p.method, amount: fromKobo(p.amount) })),
    change: fromKobo(r.changeGiven ?? 0),
    status: lay?.status === "open" ? "reserved" : r.deliveryMethod === "ship" ? "processing" : "completed",
    fulfilment: r.deliveryMethod === "ship" ? "delivery" : "instore",
    createdAt: typeof r.placedAt === "string" ? r.placedAt : new Date(r.placedAt ?? Date.now()).toISOString(),
    returns: [],
    pointsEarned: 0,
    pointsRedeemed: 0,
    synced: true,
    reservation: lay
      ? {
          deposit: fromKobo(lay.deposit),
          balance: fromKobo(lay.balance),
          until: typeof lay.until === "string" ? lay.until : new Date(lay.until).toISOString(),
          status: lay.status as "open" | "paid" | "cancelled",
          paidAt: lay.paidAt ? (typeof lay.paidAt === "string" ? lay.paidAt : new Date(lay.paidAt).toISOString()) : undefined,
        }
      : undefined,
    delivery:
      r.deliveryMethod === "ship"
        ? {
            name: addr.fullName ?? r.customer?.name ?? "Customer",
            phone: addr.phone ?? r.customer?.phone ?? "",
            address: addr.address ?? "",
            city: addr.city ?? addr.state ?? "",
            zone: r.shippingRateName ?? "Delivery",
            fee: fromKobo(r.shipping ?? 0),
            fromStoreId: r.locationId ?? "",
            status: shipUiStatus(r.status),
            eta: r.expectedDeliveryAt
              ? typeof r.expectedDeliveryAt === "string"
                ? r.expectedDeliveryAt
                : new Date(r.expectedDeliveryAt).toISOString()
              : new Date(Date.now() + 3 * 86400e3).toISOString(),
          }
        : undefined,
  };
}

function mergeLiveOrders(rows: any[]) {
  const mapped = (Array.isArray(rows) ? rows : []).map(saleRowToOrder);
  const local = useDb.getState().orders;
  const byId = new Map(local.map((o) => [o.id, o]));
  for (const o of mapped) byId.set(o.id, { ...(byId.get(o.id) ?? o), ...o, lines: o.lines.length ? o.lines : byId.get(o.id)?.lines ?? [] });
  useDb.setState({ orders: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

export default function Services() {
  const [tab, setTab] = useState<Tab>((sessionStorage.getItem("services-tab") as Tab) || "layaway");
  const orders = useDb((s) => s.orders);
  const alterations = useDb((s) => s.alterations);
  const { store } = useRegister();
  const live = liveMode();

  useEffect(() => {
    if (!live) return;
    Promise.all([
      posApi.listSales({ fulfilment: "layaway", locationId: store.id, pageSize: 80 }),
      posApi.listSales({ fulfilment: "ship", locationId: store.id, pageSize: 80 }),
    ])
      .then(([lay, ship]) => {
        mergeLiveOrders([...(Array.isArray(lay) ? lay : []), ...(Array.isArray(ship) ? ship : [])]);
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load services"));
  }, [live, store.id, tab]);

  const counts = useMemo(
    () => ({
      layaway: orders.filter((o) => o.storeId === store.id && o.reservation?.status === "open").length,
      alterations: alterations.filter((a) => a.storeId === store.id && a.status !== "collected").length,
      deliveries: orders.filter((o) => o.delivery && (o.delivery.fromStoreId === store.id || o.storeId === store.id) && o.delivery.status !== "delivered").length,
    }),
    [orders, alterations, store.id],
  );
  const pick = (t: Tab) => (sessionStorage.setItem("services-tab", t), setTab(t));
  const label = (s: string, n: number) => (
    <span className="inline-flex items-center gap-1.5">
      {s}
      {n > 0 && <span className="tnum rounded-full bg-gold px-1.5 text-[10.5px] font-semibold text-white">{n}</span>}
    </span>
  );

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-muted">Reservations, alterations and deliveries for {store.name}.</p>
        <div className="mt-5">
          <Segmented
            value={tab}
            onChange={pick}
            options={[
              { value: "layaway", label: label("Reservation", counts.layaway) },
              { value: "alterations", label: label("Alterations", counts.alterations) },
              { value: "deliveries", label: label("Deliveries", counts.deliveries) },
            ]}
          />
        </div>
        <div className="mt-5">
          {tab === "layaway" && <Reservations />}
          {tab === "alterations" && <Alterations />}
          {tab === "deliveries" && <Deliveries />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Reservation ---------- */

function Reservations() {
  const orders = useDb((s) => s.orders);
  const { store } = useRegister();
  const [paying, setPaying] = useState<Order | null>(null);
  const list = useMemo(() => {
    const mine = orders.filter((o) => o.reservation && o.storeId === store.id);
    const open = mine.filter((o) => o.reservation!.status === "open").sort((a, b) => a.reservation!.until.localeCompare(b.reservation!.until));
    const done = mine.filter((o) => o.reservation!.status !== "open").slice(0, 8);
    return { open, done };
  }, [orders, store.id]);

  const cancel = async (o: Order) => {
    const who = await approvePerm("refund", "Cancel this reservation?", "The items go back on the shelf. Cancelling needs someone who can give refunds.");
    if (!who) return;
    try {
      const r = await cancelReservation(o.id, who.id);
      if (!r) return;
      toast(r.how === "wallet" ? `Reservation cancelled. ${naira(r.paid)} deposit moved to ${o.customerName ?? "the customer"}'s ASL Wallet.` : r.how === "original" ? `Reservation cancelled. Refund the ${naira(r.paid)} deposit the way it was paid.` : `Reservation cancelled. The ${naira(r.paid)} deposit is kept, as set in the admin.`, "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return (
    <>
      <p className="mb-4 rounded-lg bg-canvas px-4 py-3 text-[13px] text-ink-2">To reserve items, add them to a sale and choose <b>Take a deposit</b> at checkout. The items are taken off the shelf until the balance is paid.</p>
      {!list.open.length && <Empty icon={<CalendarClock size={20} />} title="No open reservations" body="Items set aside on a deposit show here." />}
      <div className="space-y-3">
        {list.open.map((o) => (
          <ReservationCard key={o.id} o={o} onPay={() => setPaying(o)} onCancel={() => cancel(o)} />
        ))}
      </div>
      {list.done.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted">Recently finished</h2>
          <div className="space-y-3">
            {list.done.map((o) => (
              <ReservationCard key={o.id} o={o} />
            ))}
          </div>
        </>
      )}
      {paying && <BalanceDialog order={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

function ReservationCard({ o, onPay, onCancel }: { o: Order; onPay?: () => void; onCancel?: () => void }) {
  const r = o.reservation!;
  const paid = o.payments.reduce((a, p) => a + p.amount, 0);
  const left = daysFrom(r.until);
  const tone: Tone = r.status === "paid" ? "good" : r.status === "cancelled" ? "neutral" : left < 0 ? "bad" : left <= 3 ? "warn" : "gold";
  const state = r.status === "paid" ? "Paid and collected" : r.status === "cancelled" ? "Cancelled" : left < 0 ? `Overdue by ${-left} ${left === -1 ? "day" : "days"}` : left === 0 ? "Due today" : `Hold until ${shortDay(r.until)}`;
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-card" data-testid="layaway-card">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex -space-x-3">
          {o.lines.slice(0, 3).map((l, i) => (
            <img key={i} src={l.image} alt="" className="h-14 w-11 rounded-md border-2 border-white object-cover" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {o.customerName ?? "Walk-in customer"} <span className="font-normal text-muted">· {o.number}</span>
          </p>
          <p className="truncate text-[13px] text-muted">{o.lines.map((l) => `${l.name} (${l.variantLabel})`).join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={tone}>{state}</Badge>
            <Badge>Started {fmtDate(o.createdAt)}</Badge>
          </div>
        </div>
        <div className="tnum text-right text-[13px]">
          <p className="text-muted">Paid {naira(paid)} of {naira(o.total)}</p>
          <p className="text-lg font-semibold">{r.status === "open" ? `${naira(r.balance)} to pay` : naira(o.total)}</p>
        </div>
      </div>
      {r.status === "open" && (
        <>
          <div className="mt-3 h-1.5 rounded-full bg-canvas">
            <div className="h-1.5 rounded-full bg-gold" style={{ width: `${Math.min(100, (paid / o.total) * 100)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" icon={<X size={15} />} onClick={onCancel}>
              Cancel reservation
            </Button>
            <Button size="sm" variant="primary" icon={<Wallet size={15} />} onClick={onPay} data-testid="take-balance">
              Take payment
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const PAY_ICON: Record<string, typeof Banknote> = { cash: Banknote, card: CreditCard, transfer: Landmark, wallet: Wallet };

function BalanceDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const customer = useDb((s) => s.customers.find((c) => c.id === order.customerId));
  const ps = useDb((s) => s.settings.payments);
  const balance = order.reservation!.balance;
  const live = liveMode();
  const methods = (["cash", "card", "transfer", "wallet"] as const).filter((m) => ps[m] && (m !== "wallet" || (customer?.walletBalance ?? 0) > 0));
  const [method, setMethod] = useState<PayMethod>(methods[0] ?? "cash");
  const [amount, setAmount] = useState(String(balance));
  const [ref, setRef] = useState("");
  const n = Math.min(Number(amount.replace(/\D/g, "")) || 0, balance, method === "wallet" ? customer?.walletBalance ?? 0 : Infinity);
  const needsRef = method === "transfer" && ps.transferNeedsRef && !ref.trim();
  const fullOnly = live && n > 0 && n !== balance;

  return (
    <Dialog
      title={`Take payment on ${order.number}`}
      sub={live ? `${order.customerName ?? "Customer"} owes ${naira(balance)}. Pay the full balance to hand over.` : `${order.customerName ?? "Customer"} owes ${naira(balance)}. Part payments are fine.`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!n || needsRef || fullOnly}
          data-testid="record-balance"
          onClick={async () => {
            try {
              await settleReservation(order.id, [{ method, amount: n, reference: ref.trim() || undefined }]);
              if (method === "wallet" && customer) useDb.getState().patchCustomer(customer.id, { walletBalance: customer.walletBalance - n });
              toast(n >= balance ? `Paid in full. Hand over the items for ${order.number}.` : `${naira(n)} taken. ${naira(balance - n)} left to pay.`);
              onClose();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Payment failed");
            }
          }}
        >
          Record {naira(n)}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {methods.map((m) => {
          const Icon = PAY_ICON[m];
          return (
            <button key={m} aria-pressed={method === m} onClick={() => setMethod(m)} className={cx("flex h-[68px] flex-col items-center justify-center gap-1 rounded-xl border text-[13px] font-medium", method === m ? "border-ink bg-ink text-white" : "border-line hover:border-line-strong")}>
              <Icon size={19} />
              {METHOD[m]}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Amount" hint={method === "wallet" ? `${naira(customer?.walletBalance ?? 0)} in the ASL Wallet` : undefined}>
          <Input aria-label="Amount" prefix="₦" inputMode="numeric" className="tnum" value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("en-NG") : ""} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {(method === "card" || method === "transfer") && (
          <Field label={method === "card" ? "Approval code" : "Sender's name or reference"}>
            <Input aria-label="Reference" value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/* ---------- Alterations ---------- */

const ALT_STATUS: Record<Alteration["status"], [string, Tone]> = {
  received: ["Received", "neutral"],
  "with-tailor": ["With the tailor", "info"],
  ready: ["Ready to collect", "good"],
  collected: ["Collected", "neutral"],
};

function Alterations() {
  const all = useDb((s) => s.alterations);
  const { store } = useRegister();
  const [filter, setFilter] = useState<"open" | Alteration["status"]>("open");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!liveMode()) return;
    let cancelled = false;
    posApi
      .listAlterations(store.id)
      .then((rows) => {
        if (!cancelled) useDb.setState({ alterations: rows });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load alterations"));
    return () => {
      cancelled = true;
    };
  }, [store.id]);

  const mine = useMemo(() => all.filter((a) => a.storeId === store.id), [all, store.id]);
  const list = useMemo(() => mine.filter((a) => (filter === "open" ? a.status !== "collected" : a.status === filter)).sort((a, b) => a.readyBy.localeCompare(b.readyBy)), [mine, filter]);
  const n = (s: Alteration["status"]) => mine.filter((a) => a.status === s).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `In progress (${mine.filter((a) => a.status !== "collected").length})` },
            { value: "received", label: `Received (${n("received")})` },
            { value: "with-tailor", label: `With tailor (${n("with-tailor")})` },
            { value: "ready", label: `Ready (${n("ready")})` },
            { value: "collected", label: "Collected" },
          ]}
        />
        <Button variant="primary" className="ml-auto" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          New alteration
        </Button>
      </div>
      {!list.length && <Empty icon={<Scissors size={20} />} title="Nothing here" body="Alterations booked at checkout show here with their ticket number." />}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((a) => (
          <AltCard key={a.id} a={a} />
        ))}
      </div>
      {adding && (
        <AlterationDialog
          items={[]}
          saleTotal={0}
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            const cart = useTill.getState().cart;
            useTill.getState().patchCart({ alterations: [...(cart.alterations ?? []), draft] });
            navigate("sell");
            toast("Alteration added to the sale. Take payment to book it in.");
          }}
        />
      )}
    </>
  );
}

function AltCard({ a }: { a: Alteration }) {
  const patch = useDb((s) => s.patchAlteration);
  const me = useMe();
  const left = daysFrom(a.readyBy);
  const late = a.status !== "ready" && a.status !== "collected" && left < 0;
  const [label, tone] = ALT_STATUS[a.status];
  const next: Record<Alteration["status"], { to: Alteration["status"]; label: string } | null> = {
    received: { to: "with-tailor", label: "Send to tailor" },
    "with-tailor": { to: "ready", label: "Mark ready" },
    ready: { to: "collected", label: "Hand over" },
    collected: null,
  };
  const step = next[a.status];
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-card" data-testid="alteration-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] text-muted">{a.number}</p>
          <p className="font-medium">{a.item}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <p className="mt-1 text-[13px]">{a.work.join(" · ")}</p>
      {a.notes && <p className="mt-1 text-[13px] text-muted">“{a.notes}”</p>}
      <div className="mt-3 space-y-1 text-[13px] text-ink-2">
        <p className="flex items-center gap-2">
          <Phone size={13} className="text-faint" />
          {a.customerName} {a.phone && <span className="tnum text-muted">· {a.phone}</span>}
        </p>
        <p className="flex items-center gap-2">
          <Scissors size={13} className="text-faint" />
          {a.tailor}
        </p>
        <p className={cx("flex items-center gap-2", late && "font-medium text-bad")}>
          <CalendarClock size={13} className={late ? "" : "text-faint"} />
          {a.status === "collected" ? `Collected ${a.collectedAt ? fmtDate(a.collectedAt) : ""}` : late ? `Late: was due ${shortDay(a.readyBy)}` : `Ready by ${shortDay(a.readyBy)}`}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={a.fee ? "neutral" : "gold"}>{a.fee ? `${naira(a.fee)} paid` : "Free with purchase"}</Badge>
        {a.orderNumber && <Badge>Order {a.orderNumber}</Badge>}
      </div>
      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        <Button size="sm" variant="ghost" icon={<Printer size={15} />} onClick={() => toast(`Ticket ${a.number} sent to the receipt printer`)}>
          Print ticket
        </Button>
        {step && (
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={15} />}
            onClick={async () => {
              if (liveMode()) {
                try {
                  await posApi.alterationStatus(a.id, step.to);
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not update alteration");
                  return;
                }
              }
              patch(a.id, { status: step.to, collectedAt: step.to === "collected" ? new Date().toISOString() : undefined });
              useDb.getState().log(`${a.number} ${ALT_STATUS[step.to][0].toLowerCase()}${me ? ` (${me.name.split(" ")[0]})` : ""}`, "pickup");
              if (step.to === "ready") toast(a.phone ? `Text sent to ${a.phone}: your alteration is ready` : "Marked ready", "info");
              else toast(`${a.number}: ${ALT_STATUS[step.to][0].toLowerCase()}`);
            }}
          >
            {step.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Deliveries ---------- */

const DEL_STEPS = ["processing", "dispatched", "delivered"] as const;
const DEL_LABEL: Record<(typeof DEL_STEPS)[number], string> = { processing: "To pack", dispatched: "Out for delivery", delivered: "Delivered" };

function Deliveries() {
  const orders = useDb((s) => s.orders);
  const stores = useDb((s) => s.stores);
  const patchOrder = useDb((s) => s.patchOrder);
  const { store } = useRegister();
  const live = liveMode();
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(
    () => orders.filter((o) => o.delivery && (o.delivery.fromStoreId === store.id || o.storeId === store.id)).sort((a, b) => DEL_STEPS.indexOf(a.delivery!.status) - DEL_STEPS.indexOf(b.delivery!.status)),
    [orders, store.id],
  );

  const advance = async (o: Order, next: (typeof DEL_STEPS)[number]) => {
    const d = o.delivery!;
    if (live) {
      setBusy(o.id);
      try {
        const sale = await posApi.advanceShip(o.id, next === "dispatched" ? "shipped" : "delivered");
        const status = shipUiStatus(sale.status);
        patchOrder(o.id, { delivery: { ...d, status } });
        toast(next === "dispatched" ? `Rider on the way for ${o.number}.` : `${o.number} delivered`);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Could not update delivery");
      } finally {
        setBusy(null);
      }
      return;
    }
    patchOrder(o.id, { delivery: { ...d, status: next } });
    useDb.getState().log(`${o.number} ${DEL_LABEL[next].toLowerCase()}`, "sale");
    toast(next === "dispatched" ? `Rider on the way. ${d.name} gets a tracking text.` : `${o.number} delivered`);
  };

  if (!list.length) return <Empty icon={<Truck size={20} />} title="No deliveries" body="Items sold here and shipped to the customer, from this store or another, show here." />;
  return (
    <div className="space-y-3">
      {list.map((o) => {
        const d = o.delivery!;
        const i = DEL_STEPS.indexOf(d.status);
        const next = DEL_STEPS[i + 1];
        const from = stores.find((s) => s.id === d.fromStoreId);
        const ours = d.fromStoreId === store.id;
        return (
          <div key={o.id} className="rounded-xl border border-line bg-white p-4 shadow-card" data-testid="delivery-card">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex -space-x-3">
                {o.lines.slice(0, 3).map((l, k) => (
                  <img key={k} src={l.image} alt="" className="h-14 w-11 rounded-md border-2 border-white object-cover" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.name} <span className="font-normal text-muted">· {o.number}</span>
                </p>
                <p className="flex items-center gap-1.5 text-[13px] text-muted">
                  <MapPin size={13} />
                  {d.address}, {d.city} · {d.zone}
                </p>
                <p className="truncate text-[13px] text-muted">{o.lines.map((l) => `${l.name} (${l.variantLabel})`).join(", ")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={d.status === "delivered" ? "good" : d.status === "dispatched" ? "info" : "warn"}>{DEL_LABEL[d.status]}</Badge>
                  <Badge tone={ours ? "gold" : "neutral"}>Ships from {ours ? "this store" : from?.name}</Badge>
                  {d.status !== "delivered" && <Badge>Due {shortDay(d.eta)}</Badge>}
                  <Badge>Fee {d.fee ? naira(d.fee) : "free"}</Badge>
                </div>
              </div>
            </div>
            <ol className="mt-4 flex gap-1.5">
              {DEL_STEPS.map((s, k) => (
                <li key={s} className="flex-1">
                  <span className={cx("block h-1.5 rounded-full", k <= i ? "bg-gold" : "bg-canvas")} />
                  <span className={cx("mt-1 block text-[11px]", k <= i ? "text-ink-2" : "text-faint")}>{DEL_LABEL[s]}</span>
                </li>
              ))}
            </ol>
            {next && (
              <div className="mt-3 flex justify-end">
                {ours || next === "delivered" ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy === o.id}
                    icon={next === "dispatched" ? <Truck size={15} /> : <Check size={15} />}
                    onClick={() => void advance(o, next)}
                  >
                    {next === "dispatched" ? "Hand to rider" : "Mark delivered"}
                  </Button>
                ) : (
                  <p className="text-[13px] text-muted">{from?.name} packs and sends this one.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
