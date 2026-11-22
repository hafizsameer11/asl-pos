import { useEffect, useState } from "react";
import { create } from "zustand";
import { Delete, ShieldCheck } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { hasApiPerm } from "../api/permissions";
import { posApi } from "../api/pos";
import { emptyCart, findVariant, uid, useDb, useTill, type Cart } from "../data/store";
import { label } from "../data/seed";
import type { AuditEvent, Extra, Order, Payment, Permission, ReturnRec, Staff } from "../data/types";
import { livePromos, naira, quote, refundFor, type Quote } from "../lib/pricing";
import { Dialog, cx } from "../ui/kit";

export function useMe(): Staff | undefined {
  const id = useTill((s) => s.staffId);
  return useDb((s) => s.staff.find((p) => p.id === id));
}

export function useRegister() {
  const id = useTill((s) => s.registerId);
  const reg = useDb((s) => s.registers.find((r) => r.id === id))!;
  const store = useDb((s) => s.stores.find((x) => x.id === reg.storeId))!;
  const warehouseId = reg.warehouseId ?? store.warehouseId ?? store.id;
  return { reg, store, warehouseId };
}

/** Stock key for a boutique/warehouse row (live POS warehouses). */
export function stockKeyOf(store: { id: string; warehouseId?: string }) {
  return store.warehouseId ?? store.id;
}

export function can(staff: Staff | undefined, perm: Permission) {
  if (!staff) return false;
  if (liveMode() && staff.permissions?.length) return hasApiPerm(staff.permissions, perm);
  return !!useDb.getState().settings.roles[staff.role][perm];
}

/* ---------- Manager approval: any action can ask for a PIN from someone allowed to do it. ---------- */

interface ApprovalReq {
  title: string;
  why: string;
  check: (s: Staff) => boolean;
  resolve: (s: Staff | null) => void;
}
const useApprovalStore = create<{ req: ApprovalReq | null }>(() => ({ req: null }));

/** Resolves with whoever approved (the signed-in person if they're allowed), or null if cancelled. */
export function approve(title: string, why: string, check: (s: Staff) => boolean): Promise<Staff | null> {
  const me = useDb.getState().staff.find((p) => p.id === useTill.getState().staffId);
  if (me && check(me)) return Promise.resolve(me);
  return new Promise((resolve) => useApprovalStore.setState({ req: { title, why, check, resolve } }));
}

export const approvePerm = (perm: Permission, title: string, why: string) =>
  approve(title, why, (s) => (liveMode() && s.permissions?.length ? hasApiPerm(s.permissions, perm) : useDb.getState().settings.roles[s.role][perm]));

export function ApprovalHost() {
  const req = useApprovalStore((s) => s.req);
  const staff = useDb((s) => s.staff);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!req) return null;
  const done = (s: Staff | null) => {
    req.resolve(s);
    useApprovalStore.setState({ req: null });
    setPin("");
    setError("");
    setBusy(false);
  };
  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError("");
    if (next.length !== 4) return;
    if (liveMode()) {
      setBusy(true);
      void posApi
        .verifyPin(next)
        .then(({ staff: who, raw }) => {
          const enriched: Staff = {
            ...who,
            permissions: raw.permissions,
            discountLimitPct: raw.discountLimitPct,
          };
          if (req.check(enriched)) done(enriched);
          else {
            setError(`${who.name.split(" ")[0]} isn't allowed to approve this.`);
            setPin("");
            setBusy(false);
          }
        })
        .catch(() => {
          setError("That PIN isn't right.");
          setPin("");
          setBusy(false);
        });
      return;
    }
    const who = staff.find((s) => s.pin === next && s.active);
    if (who && req.check(who)) done(who);
    else {
      setError(who ? `${who.name.split(" ")[0]} isn't allowed to approve this.` : "That PIN isn't right.");
      setPin("");
    }
  };
  return (
    <Dialog title={req.title} sub={req.why} size="sm" onClose={() => done(null)}>
      <div className="flex items-center gap-3 rounded-lg bg-gold-soft p-3 text-[13px] text-gold-ink">
        <ShieldCheck size={18} />
        Someone who is allowed enters their PIN to approve.
      </div>
      <PinPad value={pin} onDigit={press} onBack={() => setPin((p) => p.slice(0, -1))} error={error} />
    </Dialog>
  );
}

export function PinPad({ value, onDigit, onBack, error, dark }: { value: string; onDigit: (d: string) => void; onBack: () => void; error?: string; dark?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[300px] pt-4">
      <div className="mb-2 flex justify-center gap-3" aria-label={`${value.length} of 4 digits`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx("h-3.5 w-3.5 rounded-full border-2", i < value.length ? "border-ink bg-ink" : "border-line-strong")} />
        ))}
      </div>
      <p role="alert" className="mb-3 h-5 text-center text-[13px] text-bad">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((d) =>
          d === "" ? (
            <span key="blank" />
          ) : d === "back" ? (
            <button key={d} aria-label="Delete digit" onClick={onBack} className="flex h-14 items-center justify-center rounded-xl text-muted hover:bg-canvas">
              <Delete size={22} />
            </button>
          ) : (
            <button key={d} onClick={() => onDigit(d)} className={cx("h-14 rounded-xl border text-xl font-medium transition-colors", dark ? "border-line bg-white hover:bg-canvas" : "border-line bg-white hover:bg-canvas active:bg-line")}>
              {d}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Audit trail ---------- */

/** Records a sensitive action against this till and the signed-in person. */
export function auditHere(action: AuditEvent["action"], text: string, extra: Partial<Pick<AuditEvent, "approvedBy" | "amount" | "ref">> = {}) {
  const db = useDb.getState();
  const till = useTill.getState();
  const reg = db.registers.find((r) => r.id === till.registerId);
  const by = till.staffId ?? "";
  db.audit({ action, text, storeId: reg?.storeId, registerId: reg?.id, staffId: by, ...extra, approvedBy: extra.approvedBy && extra.approvedBy !== by ? extra.approvedBy : undefined });
}

/* ---------- Pricing the current cart ---------- */

/** Charges on the sale that aren't catalogue items. */
export function cartExtras(cart: Cart): Extra[] {
  return [
    ...(cart.giftCards ?? []).map((g) => ({ kind: "giftcard" as const, label: "Gift card", amount: g.amount })),
    ...(cart.alterations ?? []).map((a) => ({ kind: "alteration" as const, label: `Alteration · ${a.work.join(", ")}`, amount: a.fee })),
    ...(cart.delivery ? [{ kind: "delivery" as const, label: `Delivery · ${cart.delivery.zone}`, amount: cart.delivery.fee }] : []),
  ];
}

function quoteArgs(cart: Cart, db: ReturnType<typeof useDb.getState>, storeId: string | undefined) {
  return {
    lines: cart.lines.map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return { qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, category: p?.category, brand: p?.brand, noPromo: !!l.discount || l.unitPrice !== l.listPrice };
    }),
    coupon: db.coupons.find((c) => c.code === cart.couponCode),
    couponCode: cart.couponCode,
    manual: cart.manual,
    pointsToUse: cart.pointsToUse,
    customer: db.customers.find((c) => c.id === cart.customerId),
    settings: db.settings,
    exchangeCredit: cart.exchange?.credit,
    promos: livePromos(db.promotions, "pos", storeId),
    extras: cartExtras(cart),
  };
}

export function useQuote(cart: Cart, fulfilmentHint?: "instore" | "ship" | "layaway") {
  const db = useDb();
  const registerId = useTill((s) => s.registerId);
  const offline = useTill((s) => s.offline);
  const storeId = db.registers.find((r) => r.id === registerId)?.storeId;
  const local = quote(quoteArgs(cart, db, storeId));
  const [remote, setRemote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!liveMode() || offline || !cart.lines.length) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    const fulfilment =
      fulfilmentHint ?? (cart.delivery && cart.lines.some((l) => l.shipFrom) ? "ship" : "instore");
    const t = window.setTimeout(() => {
      posApi
        .quote(cart, fulfilment)
        .then((q) => {
          if (cancelled) return;
          const due = fulfilment === "layaway" && q.depositDue != null ? q.depositDue : q.due;
          setRemote({
            ...local,
            ...q,
            due,
            credit: local.credit,
            earn: local.earn,
            extras: local.extras,
            lineDiscounts: q.lineDiscounts ?? local.lineDiscounts,
            promoTotal: q.promoTotal ?? local.promoTotal,
            couponError: q.couponError ?? null,
            lines: q.lines.map((l, i) => ({
              gross: l.gross,
              lineDiscount: l.lineDiscount,
              promo: (l as { promo?: number }).promo ?? local.lines[i]?.promo ?? 0,
              net: l.net,
            })),
            promos: q.promos ?? local.promos,
          });
        })
        .catch(() => {
          if (!cancelled) setRemote(null);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // local snapshot intentionally omitted — we merge latest local fields when remote arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liveMode(),
    offline,
    fulfilmentHint,
    cart.lines,
    cart.customerId,
    cart.couponCode,
    cart.manual,
    cart.pointsToUse,
    cart.giftCards,
    cart.alterations,
    cart.delivery,
    cart.exchange,
  ]);

  return remote ?? local;
}

export const newGiftCode = () => `GC-${String(Math.floor(1000 + Math.random() * 9000))}-${String(Math.floor(1000 + Math.random() * 9000))}`;

/** Stashed when a live offline sale falls through to the local path. */
let pendingOfflineSync: unknown;

/* ---------- Writing sales and returns ---------- */

/** `reserve`: layaway. The payments are a deposit; stock is set aside and the rest is paid on collection. */
export async function completeSale(payments: Payment[], change: number, refundMethod?: Payment["method"], opts: { reserve?: boolean } = {}): Promise<{ order: Order; ret?: ReturnRec; giftCodes: string[] }> {
  const db = useDb.getState();
  const till = useTill.getState();
  const cart = till.cart;
  const reg = db.registers.find((r) => r.id === till.registerId)!;
  const customer = db.customers.find((c) => c.id === cart.customerId);

  if (liveMode()) {
    if (!till.sessionId) throw new ApiError(400, "NO_SESSION", "Open a register session first.");
    const fulfilment = opts.reserve ? "layaway" : cart.delivery && cart.lines.some((l) => l.shipFrom) ? "ship" : "instore";
    const clientKey = till.offline ? `offline-${uid()}${Date.now()}` : undefined;
    const saleOpts = {
      registerSessionId: till.sessionId,
      fulfilment: fulfilment as "instore" | "ship" | "layaway",
      depositNaira: opts.reserve ? payments.reduce((a, p) => a + p.amount, 0) : undefined,
      clientKey,
      note: cart.note,
    };
    const syncPayload = clientKey ? posApi.completeSaleBody(cart, payments, change, saleOpts) : undefined;
    try {
      const sale = await posApi.completeSale(cart, payments, change, saleOpts);
      const order: Order = {
        id: sale.id,
        number: sale.number,
        channel: "pos",
        storeId: reg.storeId,
        registerId: reg.id,
        sessionId: till.sessionId ?? undefined,
        staffId: till.staffId ?? undefined,
        customerId: sale.customer?.id ?? customer?.id,
        customerName: sale.customer?.name ?? customer?.name,
        lines: sale.items.map((i) => {
          const local = findVariant(db.products, i.variantId ?? "");
          return {
            productId: local?.product.id ?? "",
            variantId: i.variantId ?? "",
            name: i.name,
            brand: i.brand,
            image: i.imageUrl ?? local?.product.image ?? "",
            variantLabel: [i.size, i.color].filter(Boolean).join(" / "),
            sku: i.sku ?? "",
            qty: i.qty,
            unitPrice: i.unitPrice,
            lineDiscount: i.lineDiscount,
            net: i.lineTotal,
            returnedQty: 0,
          };
        }),
        subtotal: sale.subtotal,
        discountTotal: sale.discount,
        pointsRedeemed: 0,
        total: sale.total,
        vat: sale.taxIncluded,
        payments: sale.payments.map((p) => ({ method: p.method as Payment["method"], amount: p.amount, reference: p.reference })),
        change,
        status: sale.layaway ? "reserved" : "completed",
        fulfilment: fulfilment === "ship" ? "delivery" : "instore",
        createdAt: typeof sale.placedAt === "string" ? sale.placedAt : new Date(sale.placedAt).toISOString(),
        returns: [],
        pointsEarned: 0,
        synced: true,
        note: cart.note,
        reservation: sale.layaway
          ? { deposit: sale.layaway.deposit, balance: sale.layaway.balance, until: sale.layaway.until, status: sale.layaway.status as "open" | "paid" | "cancelled" }
          : undefined,
      };
      db.addOrder(order);
      db.log(`${order.number} · ${reg.name} ${opts.reserve ? "reserved" : "sold"} via API`, "sale");
      for (const a of cart.alterations ?? []) {
        try {
          await posApi.createAlteration({
            customerId: customer?.id,
            customerName: customer?.name ?? "Walk-in",
            phone: customer?.phone ?? "0000000000",
            orderNumber: order.number,
            item: a.item,
            work: a.work,
            notes: a.notes,
            fee: Math.round(a.fee * 100),
            locationId: reg.storeId,
            tailor: a.tailor,
            readyBy: a.readyBy,
          });
        } catch {
          /* alteration is best-effort after sale */
        }
      }
      useTill.setState({ cart: emptyCart() });
      return { order, giftCodes: [] };
    } catch (e) {
      if (till.offline && (e instanceof TypeError || (e instanceof ApiError && e.status >= 500))) {
        pendingOfflineSync = syncPayload;
      } else {
        throw e;
      }
    }
  }

  const q = quote(quoteArgs(cart, db, reg.storeId));
  const number = db.nextNumber();
  const now = new Date().toISOString();
  const giftCodes = (cart.giftCards ?? []).map(() => newGiftCode());
  let gi = 0;
  const extras = cartExtras(cart).map((x) => (x.kind === "giftcard" ? { ...x, ref: giftCodes[gi++] } : x));
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const shipping = cart.lines.filter((l) => l.shipFrom);
  const svc = db.settings.services;
  const zone = svc.zones.find((z) => z.name === cart.delivery?.zone);
  const offlineClientKey = liveMode() && till.offline ? `offline-${uid()}${Date.now()}` : undefined;
  const offlineSync =
    pendingOfflineSync ??
    (liveMode() && till.offline && till.sessionId
      ? posApi.completeSaleBody(cart, payments, change, {
          registerSessionId: till.sessionId,
          fulfilment: opts.reserve ? "layaway" : cart.delivery && cart.lines.some((l) => l.shipFrom) ? "ship" : "instore",
          depositNaira: opts.reserve ? paid : undefined,
          clientKey: offlineClientKey,
          note: cart.note,
        })
      : undefined);
  pendingOfflineSync = undefined;
  const order: Order = {
    id: uid(),
    number,
    channel: "pos",
    storeId: reg.storeId,
    registerId: reg.id,
    sessionId: till.sessionId ?? undefined,
    staffId: till.staffId ?? undefined,
    customerId: customer?.id,
    customerName: customer?.name,
    lines: cart.lines.map((l, i) => {
      const { product, variant } = findVariant(db.products, l.variantId)!;
      return {
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        brand: product.brand,
        image: product.image,
        variantLabel: label(variant),
        sku: variant.sku,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineDiscount: q.lines[i].lineDiscount,
        promo: q.lines[i].promo || undefined,
        net: q.lines[i].net,
        returnedQty: 0,
        soldBy: l.soldBy ?? cart.associateId ?? till.staffId ?? undefined,
        shipFrom: l.shipFrom,
      };
    }),
    subtotal: q.subtotal,
    discountTotal: q.discountTotal,
    promos: q.promos.length ? q.promos : undefined,
    extras: extras.length ? extras : undefined,
    couponCode: q.coupon ? cart.couponCode : undefined,
    couponAmount: q.coupon || undefined,
    manualDiscount: q.manual ? { amount: q.manual, reason: cart.manual?.reason ?? "Discount" } : undefined,
    pointsRedeemed: q.pointsUsed,
    total: q.total,
    vat: q.vat,
    payments,
    change,
    status: opts.reserve ? "reserved" : "completed",
    fulfilment: shipping.length && shipping.length === cart.lines.length ? "delivery" : "instore",
    createdAt: now,
    returns: [],
    // On a layaway, points are earned when the balance is paid.
    pointsEarned: opts.reserve ? 0 : q.earn,
    synced: !till.offline,
    note: cart.note,
    creditApplied: cart.exchange ? Math.min(cart.exchange.credit, q.total) : undefined,
    exchangeFrom: cart.exchange?.number,
    reservation: opts.reserve ? { deposit: paid, balance: q.due - paid, until: new Date(Date.now() + svc.holdDays * 86400e3).toISOString(), status: "open" } : undefined,
    delivery: cart.delivery && shipping.length ? { ...cart.delivery, fromStoreId: shipping[0].shipFrom!, status: "processing", eta: new Date(Date.now() + (zone?.days ?? 2) * 86400e3).toISOString() } : undefined,
  };
  db.addOrder(offlineSync ? ({ ...order, syncPayload: offlineSync } as Order & { syncPayload?: unknown }) : order);
  for (const l of cart.lines) db.moveStock(l.variantId, l.shipFrom ?? reg.storeId, -l.qty);
  if (customer) {
    const creditUsed = payments.filter((p) => p.method === "wallet").reduce((a, p) => a + p.amount, 0);
    db.patchCustomer(customer.id, { loyaltyPoints: customer.loyaltyPoints - q.pointsUsed + order.pointsEarned, walletBalance: customer.walletBalance - creditUsed, spend: customer.spend + q.total, orders: customer.orders + 1 });
  }
  // Gift cards spent on this sale.
  for (const p of payments.filter((x) => x.method === "giftcard")) {
    const g = useDb.getState().giftCards.find((x) => x.code === p.reference);
    if (g) db.upsertGiftCard({ ...g, balance: g.balance - p.amount, status: g.balance - p.amount <= 0 ? "used" : "active", history: [...g.history, { at: now, amount: -p.amount, kind: "redeemed", ref: number }] });
  }
  // Gift cards sold on this sale.
  extras
    .filter((x) => x.kind === "giftcard")
    .forEach((x) => {
      db.upsertGiftCard({ code: x.ref!, initial: x.amount, balance: x.amount, issuedAt: now, storeId: reg.storeId, customerId: customer?.id, expires: new Date(Date.now() + svc.giftCardExpiryMonths * 30.4 * 86400e3).toISOString(), status: "active", history: [{ at: now, amount: x.amount, kind: "issued", ref: number }] });
      auditHere("giftcard", `Sold gift card ${x.ref} for ${naira(x.amount)}`, { amount: x.amount, ref: x.ref });
    });
  for (const a of cart.alterations ?? []) {
    db.addAlteration({ customerId: customer?.id, customerName: customer?.name ?? "Walk-in customer", phone: customer?.phone ?? "", orderNumber: number, item: a.item, work: a.work, notes: a.notes, fee: a.fee, storeId: reg.storeId, staffId: till.staffId ?? "", tailor: a.tailor, createdAt: now, readyBy: a.readyBy, status: "received" });
  }
  if (opts.reserve) auditHere("reservation", `Reservation ${number}: ${naira(paid)} deposit, ${naira(q.due - paid)} to pay by ${new Date(order.reservation!.until).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`, { amount: paid, ref: number });
  let ret: ReturnRec | undefined;
  if (cart.exchange) {
    const diff = cart.exchange.credit - q.total;
    ret = await recordReturn(cart.exchange.orderId, cart.exchange.lines, cart.exchange.reason, diff > 0 ? [{ method: refundMethod ?? "cash", amount: diff }] : [], "exchange", number, cart.exchange.approvedBy);
  }
  db.log(`${number} · ${reg.name} ${opts.reserve ? "reserved" : "sold"} ${order.lines.reduce((a, l) => a + l.qty, 0)} items${till.offline ? " (offline, will sync)" : ""}`, "sale");
  useTill.setState({ cart: emptyCart() });
  return { order, ret, giftCodes };
}

/** Pays off a layaway and hands the items over. */
export async function settleReservation(orderId: string, payments: Payment[]) {
  if (liveMode()) {
    const till = useTill.getState();
    await posApi.settleLayaway(orderId, payments, 0, till.sessionId ?? undefined);
    const sale = await posApi.getSale(orderId);
    useDb.getState().patchOrder(orderId, {
      status: "completed",
      payments: sale.payments.map((p) => ({ method: p.method as Payment["method"], amount: p.amount, reference: p.reference })),
      reservation: sale.layaway
        ? { deposit: sale.layaway.deposit, balance: sale.layaway.balance, until: sale.layaway.until, status: "paid", paidAt: new Date().toISOString() }
        : undefined,
      collectedAt: new Date().toISOString(),
    });
    useDb.getState().log(`${sale.number} layaway settled`, "sale");
    return;
  }
  const db = useDb.getState();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o?.reservation) return;
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const left = o.reservation.balance - paid;
  const earn = left <= 0 ? Math.floor((o.total / db.settings.loyalty.earnPer) * (db.customers.find((c) => c.id === o.customerId) ? db.settings.loyalty.multipliers[db.customers.find((c) => c.id === o.customerId)!.tier] : 0)) : 0;
  db.patchOrder(o.id, {
    payments: [...o.payments, ...payments],
    status: left <= 0 ? "completed" : "reserved",
    collectedAt: left <= 0 ? new Date().toISOString() : undefined,
    pointsEarned: earn,
    reservation: { ...o.reservation, balance: Math.max(0, left), status: left <= 0 ? "paid" : "open", paidAt: left <= 0 ? new Date().toISOString() : undefined },
  });
  const c = db.customers.find((x) => x.id === o.customerId);
  if (c && earn) db.patchCustomer(c.id, { loyaltyPoints: c.loyaltyPoints + earn });
  db.log(`${o.number} reservation ${left <= 0 ? "paid off and collected" : `part paid, ${naira(left)} left`}`, "sale");
}

/** Cancels a layaway: stock goes back on the shelf and the deposit is handled as the admin says. */
export async function cancelReservation(orderId: string, approvedBy?: string) {
  if (liveMode()) {
    const how = useDb.getState().settings.services.cancelRefund;
    const refundTo = how === "wallet" ? "wallet" : how === "original" ? "original" : "kept";
    const out = (await posApi.cancelLayaway(orderId, { refundTo, forfeitDeposit: refundTo === "kept" })) as {
      deposit?: number;
      refundTo?: "kept" | "wallet" | "original";
      order?: { number?: string; layaway?: { deposit?: number } };
    };
    const paid = out.deposit != null ? fromKobo(out.deposit) : fromKobo(out.order?.layaway?.deposit ?? 0);
    useDb.getState().patchOrder(orderId, { status: "cancelled", reservation: undefined });
    auditHere("reservation", `Cancelled layaway ${out.order?.number ?? orderId}`, { amount: paid, approvedBy });
    return { paid, how: (out.refundTo ?? refundTo) as "kept" | "wallet" | "original" };
  }
  const db = useDb.getState();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o?.reservation) return;
  const paid = o.payments.reduce((a, p) => a + p.amount, 0);
  const how = db.settings.services.cancelRefund;
  for (const l of o.lines) db.moveStock(l.variantId, o.storeId ?? "LOC-1001", l.qty);
  db.patchOrder(o.id, { status: "cancelled", reservation: { ...o.reservation, status: "cancelled" } });
  const c = db.customers.find((x) => x.id === o.customerId);
  if (c) db.patchCustomer(c.id, { walletBalance: c.walletBalance + (how === "wallet" ? paid : 0), spend: Math.max(0, c.spend - o.total), orders: Math.max(0, c.orders - 1) });
  auditHere("reservation", `Cancelled reservation ${o.number}. Deposit ${naira(paid)} ${how === "wallet" ? "moved to the ASL Wallet" : how === "original" ? "refunded" : "kept"}`, { amount: paid, ref: o.number, approvedBy });
  return { paid, how };
}

export async function recordReturn(
  orderId: string,
  lines: { lineIndex: number; qty: number; restock: boolean; orderItemId?: string }[],
  reason: string,
  refunds: Payment[],
  kind: ReturnRec["kind"],
  exchangeOrder?: string,
  approvedBy?: string,
  opts?: { override?: boolean },
): Promise<ReturnRec> {
  const db = useDb.getState();
  const till = useTill.getState();
  const order = db.orders.find((o) => o.id === orderId)!;
  const reg = db.registers.find((r) => r.id === till.registerId)!;

  if (liveMode()) {
    const sale = await posApi.getSale(orderId);
    const apiLines = lines.map((l) => {
      const ol = order.lines[l.lineIndex];
      const byId = l.orderItemId ? sale.items.find((i) => i.id === l.orderItemId) : undefined;
      const bySku = ol.sku ? sale.items.find((i) => i.sku === ol.sku) : undefined;
      const item = byId ?? bySku ?? sale.items.find((i) => i.variantId === ol.variantId) ?? sale.items[l.lineIndex];
      if (!item?.id) throw new ApiError(400, "VALIDATION_FAILED", "Could not match a return line to the sale.");
      return { orderItemId: item.id, qty: l.qty };
    });
    const refundTo = refunds[0]?.method === "wallet" ? "wallet" : refunds[0]?.method === "cash" ? "cash" : "original";
    const retApi = await posApi.processReturn(orderId, {
      lines: apiLines,
      reason,
      refundTo,
      restock: lines.every((l) => l.restock),
      override: !!opts?.override,
      registerSessionId: till.sessionId ?? undefined,
      approvedById: approvedBy,
    });
    const ret: ReturnRec = {
      id: (retApi as { id: string }).id,
      number: (retApi as { number: string }).number,
      createdAt: new Date().toISOString(),
      staffId: till.staffId ?? "",
      storeId: reg.storeId,
      registerId: reg.id,
      reason,
      lines: lines.map((l) => ({ ...l, amount: 0 })),
      amount: (retApi as { amount?: number }).amount != null ? fromKobo((retApi as { amount: number }).amount) : refunds.reduce((a, r) => a + r.amount, 0),
      refunds,
      kind,
      exchangeOrder,
      approvedBy,
    };
    const newLines = order.lines.map((l, i) => ({ ...l, returnedQty: l.returnedQty + lines.filter((x) => x.lineIndex === i).reduce((a, x) => a + x.qty, 0) }));
    db.patchOrder(orderId, { lines: newLines, returns: [...order.returns, ret], status: newLines.every((l) => l.returnedQty >= l.qty) ? "refunded" : "part-refunded" });
    return ret;
  }
  const done = (i: number) => order.returns.flatMap((r) => r.lines).filter((l) => l.lineIndex === i);
  const withAmounts = lines.map((l) => {
    const prev = done(l.lineIndex);
    const ol = order.lines[l.lineIndex];
    return { ...l, amount: refundFor(ol.net, ol.qty, prev.reduce((a, x) => a + x.qty, 0), prev.reduce((a, x) => a + x.amount, 0), l.qty) };
  });
  const ret: ReturnRec = {
    id: uid(),
    number: `RT-${db.seq + 1}`,
    createdAt: new Date().toISOString(),
    staffId: till.staffId ?? "",
    storeId: reg.storeId,
    registerId: reg.id,
    reason,
    lines: withAmounts,
    amount: withAmounts.reduce((a, l) => a + l.amount, 0),
    refunds: kind === "refund" ? [{ method: refunds[0]?.method ?? "cash", amount: withAmounts.reduce((a, l) => a + l.amount, 0), reference: refunds[0]?.reference }] : refunds,
    kind,
    exchangeOrder,
    approvedBy,
  };
  useDb.setState({ seq: db.seq + 1 });
  const newLines = order.lines.map((l, i) => ({ ...l, returnedQty: l.returnedQty + withAmounts.filter((x) => x.lineIndex === i).reduce((a, x) => a + x.qty, 0) }));
  const all = newLines.every((l) => l.returnedQty >= l.qty);
  db.patchOrder(order.id, { returns: [...order.returns, ret], lines: newLines, status: all ? "refunded" : "part-refunded" });
  for (const l of withAmounts) if (l.restock) db.moveStock(order.lines[l.lineIndex].variantId, reg.storeId, l.qty);
  const credit = ret.refunds.filter((p) => p.method === "wallet").reduce((a, p) => a + p.amount, 0);
  const cust = db.customers.find((c) => c.id === order.customerId);
  if (cust) db.patchCustomer(cust.id, { walletBalance: cust.walletBalance + credit, spend: Math.max(0, cust.spend - ret.amount) });
  db.log(`${ret.number} · ${kind === "exchange" ? "exchange" : "refund"} of ${ret.amount.toLocaleString()} on ${order.number}`, "refund");
  auditHere("refund", `${kind === "exchange" ? "Exchange" : "Refund"} ${ret.number} on ${order.number}: ${naira(ret.amount)} (${reason})`, { amount: ret.amount, ref: ret.number, approvedBy });
  return ret;
}
