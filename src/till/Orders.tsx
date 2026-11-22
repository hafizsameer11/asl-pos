import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Banknote, CloudOff, Mail, Printer, ReceiptText, RotateCcw } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import type { Order, PayMethod } from "../data/types";
import { naira, refundFor } from "../lib/pricing";
import { Badge, Button, ChannelBadge, Dialog, Empty, Field, SearchBox, Segmented, Select, StatusBadge, Toggle, cx, fmtDate, fmtTime, toast } from "../ui/kit";
import { METHOD, methodText, Receipt, ReturnSlip } from "../shared/Receipt";
import { approvePerm, recordReturn, useRegister } from "./common";
import { navigate } from "./Till";

function apiChannel(ch?: string): Order["channel"] {
  if (ch === "store") return "pos";
  if (ch === "mobile" || ch === "pwa") return "app";
  return "web";
}

function txToOrder(r: any): Order {
  const addr = (r.shippingAddress ?? {}) as { fullName?: string; phone?: string; address?: string; city?: string; state?: string };
  const lay = r.layaway;
  const shipStatus = (s: string): "processing" | "dispatched" | "delivered" =>
    s === "delivered" ? "delivered" : s === "shipped" || s === "out_for_delivery" ? "dispatched" : "processing";
  return {
    id: r.id,
    number: r.number,
    channel: apiChannel(r.channel),
    storeId: r.locationId ?? r.pickupLocationId ?? undefined,
    registerId: r.registerId ?? undefined,
    staffId: r.cashierId ?? undefined,
    customerId: r.customer?.id,
    customerName: r.customer?.name,
    lines: (r.items ?? r.lines ?? []).map((i: any) => ({
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
    status: (lay?.status === "open" ? "reserved" : r.deliveryMethod === "ship" ? "processing" : "completed") as Order["status"],
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
            status: shipStatus(r.status),
            eta: r.expectedDeliveryAt
              ? typeof r.expectedDeliveryAt === "string"
                ? r.expectedDeliveryAt
                : new Date(r.expectedDeliveryAt).toISOString()
              : new Date(Date.now() + 3 * 86400e3).toISOString(),
          }
        : undefined,
  };
}

export default function Orders() {
  const orders = useDb((s) => s.orders);
  const { store } = useRegister();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"here" | "online" | "all">("here");
  const [sel, setSel] = useState<string | null>(null);
  const live = liveMode();

  useEffect(() => {
    if (!live) return;
    const term = q.trim();
    const timer = window.setTimeout(() => {
      const channel = tab === "online" ? "web" : tab === "all" ? "all" : "store";
      posApi
        .listSales({ page: 1, pageSize: 80, q: term || undefined, locationId: store.id, channel })
        .then((rows) => {
          const list = (Array.isArray(rows) ? rows : []).map(txToOrder);
          const local = useDb.getState().orders;
          const byId = new Map(local.map((o) => [o.id, o]));
          for (const o of list) byId.set(o.id, { ...(byId.get(o.id) ?? o), ...o, lines: o.lines.length ? o.lines : byId.get(o.id)?.lines ?? [] });
          useDb.setState({ orders: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
        })
        .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load orders"));
    }, term ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [live, q, tab, store.id]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders
      .filter((o) => (tab === "all" ? true : tab === "here" ? o.storeId === store.id : o.channel !== "pos"))
      .filter((o) => !t || o.number.toLowerCase().includes(t) || o.customerName?.toLowerCase().includes(t) || o.lines.some((l) => l.sku.toLowerCase().includes(t) || l.name.toLowerCase().includes(t)))
      .slice(0, 80);
  }, [orders, q, tab, store.id]);
  const order = orders.find((o) => o.id === (sel ?? list[0]?.id));

  useEffect(() => {
    if (!live || !order?.id || (order.lines?.length ?? 0) > 0) return;
    void posApi
      .getSale(order.id)
      .then((sale) => {
        useDb.getState().patchOrder(order.id, {
          lines: sale.items.map((i) => ({
            productId: "",
            variantId: i.variantId ?? "",
            name: i.name,
            brand: i.brand,
            image: i.imageUrl ?? "",
            variantLabel: [i.size, i.color].filter(Boolean).join(" / "),
            sku: i.sku ?? "",
            qty: i.qty,
            unitPrice: i.unitPrice,
            lineDiscount: i.lineDiscount,
            net: i.lineTotal,
            returnedQty: 0,
          })),
          subtotal: sale.subtotal,
          discountTotal: sale.discount,
          total: sale.total,
          vat: sale.taxIncluded,
          payments: sale.payments.map((p) => ({ method: p.method as PayMethod, amount: p.amount, reference: p.reference })),
          change: sale.changeGiven,
          customerName: sale.customer?.name ?? order.customerName,
          customerId: sale.customer?.id ?? order.customerId,
          reservation: sale.layaway
            ? { deposit: sale.layaway.deposit, balance: sale.layaway.balance, until: sale.layaway.until, status: sale.layaway.status as "open" | "paid" | "cancelled" }
            : order.reservation,
        });
      })
      .catch(() => undefined);
  }, [live, order?.id, order?.lines?.length]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex max-h-[45%] min-h-0 flex-col border-b border-line bg-white md:max-h-none md:w-[380px] md:border-b-0 md:border-r lg:w-[420px]">
        <div className="space-y-3 border-b border-line p-4">
          <SearchBox value={q} onChange={setQ} placeholder="Order number, customer, SKU" />
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "here", label: "This store" },
              { value: "online", label: "Online" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        <ul className="thin-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {list.map((o) => (
            <li key={o.id}>
              <button onClick={() => setSel(o.id)} aria-current={order?.id === o.id} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", order?.id === o.id ? "bg-gold-soft" : "hover:bg-canvas")}>
                <div className="flex -space-x-3">
                  {o.lines.slice(0, 2).map((l, i) => (
                    <img key={i} src={l.image} alt="" className="h-11 w-9 rounded-md border-2 border-white object-cover" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    {o.number}
                    {!o.synced && <CloudOff size={13} className="text-warn" />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {fmtDate(o.createdAt)}, {fmtTime(o.createdAt)} · {o.customerName ?? "Walk-in"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-[13.5px] font-semibold">{naira(o.total)}</p>
                  <div className="mt-0.5 flex justify-end">{o.channel === "pos" ? <StatusBadge status={o.status} /> : <ChannelBadge channel={o.channel} />}</div>
                </div>
              </button>
            </li>
          ))}
          {!list.length && <Empty icon={<ReceiptText size={20} />} title="No orders found" body="Search by order number, customer or SKU." />}
        </ul>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{order ? <OrderDetail order={order} /> : null}</div>
    </div>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const db = useDb();
  const [returning, setReturning] = useState(false);
  const customer = db.customers.find((c) => c.id === order.customerId);
  const staff = db.staff.find((s) => s.id === order.staffId);
  const st = db.stores.find((s) => s.id === (order.storeId ?? order.pickupStoreId));
  const canReturn = order.lines.some((l) => l.returnedQty < l.qty) && (order.channel === "pos" || db.settings.returns.onlineOrdersInStore) && order.status !== "processing" && order.status !== "ready";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{order.number}</h1>
            <ChannelBadge channel={order.channel} />
            <StatusBadge status={order.status} />
            {!order.synced && <Badge tone="warn">Not synced yet</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {fmtDate(order.createdAt)}, {fmtTime(order.createdAt)} · {st?.name ?? "Online"}
            {staff && ` · ${staff.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Printer size={16} />} onClick={() => window.print()}>
            Reprint
          </Button>
          <Button
            icon={<Mail size={16} />}
            disabled={!customer?.email}
            onClick={async () => {
              if (liveMode()) {
                try {
                  await posApi.sendReceipt(order.id, "email", false, customer?.email);
                  toast(`Receipt emailed to ${customer?.email}`);
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not email receipt");
                }
                return;
              }
              toast(`Receipt emailed to ${customer?.email}`);
            }}
          >
            Email
          </Button>
          <Button variant="primary" icon={<RotateCcw size={16} />} disabled={!canReturn} onClick={() => setReturning(true)} data-testid="start-return">
            Return or exchange
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {order.lines.map((l, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <img src={l.image} alt="" className="h-14 w-11 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{l.name}</p>
                  <p className="text-xs text-muted">
                    {l.variantLabel} · {l.sku} · ×{l.qty}
                  </p>
                  {l.returnedQty > 0 && (
                    <Badge tone="warn" className="mt-1">
                      {l.returnedQty} returned
                    </Badge>
                  )}
                </div>
                <span className="tnum text-sm font-medium">{naira(l.net)}</span>
              </div>
            ))}
          </div>
          <div className="tnum grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            <Mini label="Paid" value={order.payments.map((p) => METHOD[p.method]).join(" + ") || "Credit"} />
            <Mini label="Discounts" value={naira(order.discountTotal)} />
            <Mini label="Points earned" value={order.pointsEarned.toLocaleString()} />
            <Mini label="Customer" value={customer?.name ?? "Walk-in"} />
          </div>
          {order.note && <p className="rounded-lg bg-canvas p-3 text-[13px]">Note: {order.note}</p>}
          {order.returns.map((r) => (
            <ReturnSlip key={r.id} order={order} ret={r} />
          ))}
        </div>
        <Receipt order={order} />
      </div>
      {returning && <ReturnDialog order={order} onClose={() => setReturning(false)} />}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  );
}

type ReturnableLine = {
  orderItemId: string;
  returnable: number;
  reason: string | null;
  refundPreview: number;
  bought: number;
  returned: number;
  sku?: string | null;
  name?: string;
};

type ReturnableInfo = {
  eligible: boolean;
  windowDays: number;
  windowEndsAt: string | null;
  approvalOver: number;
  reasons: string[];
  items: ReturnableLine[];
};

function ReturnDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const db = useDb();
  const rs = db.settings.returns;
  const cart = useTill((s) => s.cart);
  const live = liveMode();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [restock, setRestock] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState(rs.reasons[0]);
  const [assess, setAssess] = useState<ReturnableInfo | null>(null);
  const [loadingAssess, setLoadingAssess] = useState(live);
  const original = order.payments[0]?.method ?? "card";
  const options: PayMethod[] = [...(rs.toOriginal ? [original] : []), ...(rs.toCredit && order.customerId ? (["wallet"] as PayMethod[]) : []), ...(rs.toCash && original !== "cash" ? (["cash"] as PayMethod[]) : [])];
  const [method, setMethod] = useState<PayMethod>(options[0] ?? "cash");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    setLoadingAssess(true);
    posApi
      .returnable(order.id)
      .then((raw: any) => {
        const items: ReturnableLine[] = (raw.items ?? []).map((it: any) => ({
          orderItemId: it.orderItemId,
          returnable: it.returnable ?? 0,
          reason: it.reason ?? null,
          refundPreview: fromKobo(it.refundPreview ?? 0),
          bought: it.bought ?? 0,
          returned: it.returned ?? 0,
          sku: it.sku,
          name: it.name,
        }));
        setAssess({
          eligible: !!raw.eligible,
          windowDays: raw.windowDays ?? rs.windowDays,
          windowEndsAt: raw.windowEndsAt ? (typeof raw.windowEndsAt === "string" ? raw.windowEndsAt : new Date(raw.windowEndsAt).toISOString()) : null,
          approvalOver: raw.approvalOver != null ? fromKobo(raw.approvalOver) : rs.approvalOver,
          reasons: Array.isArray(raw.reasons) && raw.reasons.length ? raw.reasons : rs.reasons,
          items,
        });
        if (Array.isArray(raw.reasons) && raw.reasons.length) setReason(raw.reasons[0]);
        useDb.getState().patchOrder(order.id, {
          lines: order.lines.map((l, i) => {
            const server = raw.items?.[i];
            return server ? { ...l, returnedQty: server.returned ?? l.returnedQty } : l;
          }),
        });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not check return eligibility"))
      .finally(() => setLoadingAssess(false));
  }, [live, order.id]);

  const days = (Date.now() - new Date(order.createdAt).getTime()) / 86400e3;
  const windowDays = assess?.windowDays ?? rs.windowDays;
  const late = assess?.windowEndsAt ? Date.now() > new Date(assess.windowEndsAt).getTime() : days > windowDays;
  const approvalOver = assess?.approvalOver ?? rs.approvalOver;
  const reasonList = assess?.reasons ?? rs.reasons;

  const assessForLine = (i: number) => {
    if (!assess) return undefined;
    const l = order.lines[i];
    return (
      assess.items.find((it) => it.sku && l.sku && it.sku === l.sku) ??
      assess.items.find((it) => it.name && it.name === l.name) ??
      assess.items[i]
    );
  };
  const finalSale = (i: number) => {
    if (live && assess) {
      const it = assessForLine(i);
      return !!it && it.reason === "FINAL_SALE" && !/faulty|damaged/i.test(reason);
    }
    const p = db.products.find((x) => x.id === order.lines[i].productId);
    return !!p && reason !== "Faulty or damaged" && (rs.finalSale.includes(p.category) || rs.finalSale.includes(p.subcategory ?? ""));
  };
  const needsOverride = late || (live && !!assess && !assess.eligible);
  const leftQty = (i: number) => {
    if (live && assess) {
      const it = assessForLine(i);
      if (it) {
        if (needsOverride && it.returnable <= 0) return Math.max(0, it.bought - it.returned);
        return it.returnable;
      }
    }
    return order.lines[i].qty - order.lines[i].returnedQty;
  };
  const chosen = Object.entries(qty)
    .filter(([i, n]) => n > 0 && leftQty(Number(i)) > 0 && (!finalSale(Number(i)) || needsOverride))
    .map(([i, n]) => ({
      lineIndex: Number(i),
      qty: n,
      restock: restock[Number(i)] ?? (rs.restockDefault && !/faulty|damaged/i.test(reason)),
      orderItemId: assessForLine(Number(i))?.orderItemId,
    }));
  const amount = chosen.reduce((a, c) => {
    const l = order.lines[c.lineIndex];
    const prev = order.returns.flatMap((r) => r.lines).filter((x) => x.lineIndex === c.lineIndex);
    return a + refundFor(l.net, l.qty, prev.reduce((s, x) => s + x.qty, 0), prev.reduce((s, x) => s + x.amount, 0), c.qty);
  }, 0);

  const gate = () => {
    if (late) return approvePerm("refund", "Outside the return window", `${order.number} is past the ${windowDays}-day window. Approving needs refund permission.`);
    if (amount > approvalOver) return approvePerm("refund", "Large refund", `${naira(amount)} is over ${naira(approvalOver)}. Approving needs refund permission.`);
    return approvePerm("refund", "Approve this return", "Returns need a supervisor or manager.");
  };

  const refund = async () => {
    const who = await gate();
    if (!who) return;
    try {
      await recordReturn(order.id, chosen, reason, [{ method, amount }], "refund", undefined, who.id, { override: !!needsOverride });
      setDone(method);
      toast(`${naira(amount)} refunded to ${methodText(method)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Return failed");
    }
  };

  const exchange = async () => {
    const who = await gate();
    if (!who) return;
    useTill.getState().patchCart({ exchange: { orderId: order.id, number: order.number, credit: amount, reason, lines: chosen, approvedBy: who.id } });
    toast("Now add the replacement items");
    onClose();
    navigate("sell");
  };

  if (done) {
    const latest = useDb.getState().orders.find((o) => o.id === order.id)!;
    return (
      <Dialog
        title="Refund done"
        onClose={onClose}
        footer={
          <>
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>
              Print slip
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        {done === "cash" && <p className="mb-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">Give {naira(amount)} from the drawer.</p>}
        <ReturnSlip order={latest} ret={latest.returns[latest.returns.length - 1]} />
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`Return from ${order.number}`}
      sub={`${order.customerName ?? "Walk-in"} · bought ${fmtDate(order.createdAt)}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="tnum mr-auto text-lg font-semibold" data-testid="return-amount">
            {naira(amount)}
          </span>
          {rs.exchanges && (
            <Button icon={<ArrowLeftRight size={16} />} disabled={!chosen.length || cart.lines.length > 0 || !!cart.exchange} onClick={exchange}>
              Exchange
            </Button>
          )}
          <Button variant="primary" icon={<Banknote size={16} />} disabled={loadingAssess || !chosen.length || !options.length} onClick={refund} data-testid="confirm-refund">
            Refund {naira(amount)}
          </Button>
        </>
      }
    >
      {loadingAssess && <p className="mb-4 text-[13px] text-muted">Checking what can be returned…</p>}
      {live && assess && !assess.eligible && !loadingAssess && <p className="mb-4 rounded-lg bg-canvas p-3 text-[13px] text-muted">Nothing on this order can be returned right now.</p>}
      {late && <p className="mb-4 rounded-lg bg-warn-soft p-3 text-[13px] text-warn">This order is past the {windowDays}-day window. A manager must approve.</p>}
      {cart.lines.length > 0 && <p className="mb-4 rounded-lg bg-canvas p-3 text-[13px] text-muted">To exchange, finish or park the sale on the Sell screen first.</p>}
      <div className="divide-y divide-line rounded-xl border border-line">
        {order.lines.map((l, i) => {
          const left = leftQty(i);
          const n = qty[i] ?? 0;
          const blocked = live && assess?.items[i]?.reason && assess.items[i].returnable <= 0 && assess.items[i].reason !== "FINAL_SALE";
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="return-line">
              <img src={l.image} alt="" className="h-12 w-10 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{l.name}</p>
                <p className="tnum text-xs text-muted">
                  {l.variantLabel} · paid {naira(l.net)} for {l.qty}
                  {l.returnedQty > 0 && ` · ${l.returnedQty} already back`}
                </p>
              </div>
              {blocked ? (
                <Badge>Not returnable</Badge>
              ) : left > 0 && finalSale(i) ? (
                <Badge>Final sale</Badge>
              ) : left > 0 ? (
                <div className="inline-flex items-center rounded-lg border border-line">
                  <button aria-label={`Fewer ${l.name}`} disabled={n === 0} onClick={() => setQty({ ...qty, [i]: n - 1 })} className="h-10 w-10 disabled:opacity-30">
                    −
                  </button>
                  <span className="tnum w-6 text-center font-semibold">{n}</span>
                  <button aria-label={`More ${l.name}`} disabled={n >= left} onClick={() => setQty({ ...qty, [i]: n + 1 })} className="h-10 w-10 disabled:opacity-30">
                    +
                  </button>
                </div>
              ) : (
                <Badge>All returned</Badge>
              )}
              {n > 0 && !finalSale(i) && (
                <div className="w-full pl-[52px]">
                  <Toggle label="Back in stock" checked={restock[i] ?? (rs.restockDefault && !/faulty|damaged/i.test(reason))} onChange={(v) => setRestock({ ...restock, [i]: v })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasonList.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Refund to">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} aria-label="Refund to">
            {options.map((m) => (
              <option key={m} value={m}>
                {m === original ? `${METHOD[m]} (original)` : METHOD[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
