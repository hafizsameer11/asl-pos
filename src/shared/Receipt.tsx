import { useDb } from "../data/store";
import type { Order, ReturnRec, Settings, Store } from "../data/types";
import { naira } from "../lib/pricing";
import { cx, fmtDate, fmtTime } from "../ui/kit";

export const METHOD: Record<string, string> = { cash: "Cash", card: "Card", transfer: "Bank transfer", wallet: "ASL Wallet", points: "Points", giftcard: "Gift card" };
/** For use mid-sentence: "by card", "to ASL Wallet". */
export const methodText = (m: string) => (m === "wallet" ? "ASL Wallet" : (METHOD[m] ?? m).toLowerCase());

function QR() {
  // A stand-in pattern; the real receipt would encode the order link.
  const cells = Array.from({ length: 121 }, (_, i) => ((i * 7919) % 13) % 3 === 0 || [0, 1, 2, 10, 11, 12, 22, 23, 24, 96, 97, 98, 108, 109, 110, 118, 119, 120, 8, 9, 19, 20, 30, 31].includes(i));
  return (
    <div className="mx-auto grid h-16 w-16 grid-cols-11">
      {cells.map((on, i) => (
        <span key={i} className={on ? "bg-ink" : ""} />
      ))}
    </div>
  );
}

export function Receipt({ order, settings, store, gift, className }: { order: Order; settings?: Settings; store?: Store; gift?: boolean; className?: string }) {
  const db = useDb();
  const s = settings ?? db.settings;
  const st = store ?? db.stores.find((x) => x.id === order.storeId) ?? db.stores[0];
  const staff = db.staff.find((x) => x.id === order.staffId);
  const r = s.receipts;
  const narrow = r.paper === "58mm";
  return (
    <div className={cx("print-area tnum mx-auto rounded-lg border border-line bg-white px-5 py-5 font-mono text-[12px] leading-[1.55] text-ink", narrow ? "max-w-[250px]" : "max-w-[320px]", className)} data-testid="receipt">
      <div className="mb-3 text-center font-sans">
        <p className="text-[17px] font-semibold tracking-[0.22em]">ASL ORIGINALS</p>
        <p className="text-[11px] text-muted">{st.name}</p>
        <p className="text-[11px] text-muted">{st.address}</p>
        <p className="text-[11px] text-muted">{st.phone}</p>
        {r.header && <p className="mt-2 text-[12px]">{r.header}</p>}
        {gift && <p className="mt-2 font-semibold uppercase tracking-wider">Gift receipt</p>}
      </div>
      <div className="border-y border-dashed border-line-strong py-2">
        <L a="Receipt" b={order.number} />
        <L a="Date" b={`${fmtDate(order.createdAt)} ${fmtTime(order.createdAt)}`} />
        {r.showStaff && staff && <L a="Served by" b={staff.name.split(" ")[0]} />}
        {order.customerName && <L a="Customer" b={order.customerName} />}
      </div>
      <div className="py-2">
        {order.lines.map((l, i) => (
          <div key={i} className="mb-1.5">
            <L a={`${l.qty} × ${l.name}`} b={gift ? "" : naira(l.unitPrice * l.qty)} />
            <p className="text-[11px] text-muted">
              {l.variantLabel} · {l.sku}
            </p>
            {!gift && l.lineDiscount > 0 && <L a={l.promo === l.lineDiscount ? "  Offer" : "  Discount"} b={naira(-l.lineDiscount)} muted />}
            {l.shipFrom && <p className="text-[11px] text-muted">Delivered to customer</p>}
          </div>
        ))}
        {order.extras?.map((x, i) => (
          <div key={`x${i}`} className="mb-1.5">
            <L a={x.label} b={gift ? "" : x.amount ? naira(x.amount) : "Free"} />
            {x.ref && <p className="text-[11px] font-semibold">Code {x.ref}</p>}
          </div>
        ))}
      </div>
      {!gift && (
        <>
          <div className="border-t border-dashed border-line-strong pt-2">
            <L a="Subtotal" b={naira(order.subtotal)} />
            {order.promos?.map((p) => <L key={p.id} a={p.label} b={naira(-p.amount)} />)}
            {order.couponCode && <L a={`Coupon ${order.couponCode}`} b={naira(-(order.couponAmount ?? 0))} />}
            {order.manualDiscount && order.manualDiscount.amount > 0 && <L a={`Discount (${order.manualDiscount.reason})`} b={naira(-order.manualDiscount.amount)} />}
            {order.pointsRedeemed > 0 && <L a={`${order.pointsRedeemed.toLocaleString()} points`} b={naira(-order.pointsRedeemed * s.loyalty.pointValue)} />}
            <div className="mt-1 flex justify-between font-sans text-[15px] font-semibold">
              <span>Total</span>
              <span>{naira(order.total)}</span>
            </div>
            {r.showVat && <p className="text-[11px] text-muted">Includes VAT {s.general.vatRate}%: {naira(order.vat)}</p>}
          </div>
          <div className="mt-2 border-t border-dashed border-line-strong pt-2">
            {order.creditApplied ? <L a={`Exchange credit (${order.exchangeFrom})`} b={naira(order.creditApplied)} /> : null}
            {order.payments.map((p, i) => (
              <div key={i}>
                <L a={METHOD[p.method]} b={naira(p.amount + (p.method === "cash" ? order.change : 0))} />
                {p.reference && <p className="text-[11px] text-muted">Ref {p.reference}</p>}
              </div>
            ))}
            {order.change > 0 && <L a="Change" b={naira(order.change)} />}
          </div>
          {order.reservation && (
            <div className="mt-2 border-t border-dashed border-line-strong pt-2">
              <p className="font-sans font-semibold uppercase tracking-wider">Reservation</p>
              <L a="Paid so far" b={naira(order.total - order.reservation.balance)} />
              <L a="Balance due" b={naira(order.reservation.balance)} />
              <L a="Collect by" b={fmtDate(order.reservation.until)} />
            </div>
          )}
          {order.delivery && (
            <div className="mt-2 border-t border-dashed border-line-strong pt-2">
              <p className="font-sans font-semibold uppercase tracking-wider">Delivery</p>
              <p>{order.delivery.name}</p>
              <p>
                {order.delivery.address}, {order.delivery.city}
              </p>
              <L a="Expected" b={fmtDate(order.delivery.eta)} />
            </div>
          )}
          {r.showLoyalty && order.customerId && (order.pointsEarned > 0 || order.pointsRedeemed > 0) && (
            <div className="mt-2 rounded bg-canvas px-2 py-1.5 text-center text-[11px]">
              ASL Club: +{order.pointsEarned.toLocaleString()} points earned
              {order.pointsRedeemed > 0 ? `, ${order.pointsRedeemed.toLocaleString()} used` : ""}
            </div>
          )}
        </>
      )}
      {r.showPolicy && (
        <p className="mt-3 text-center text-[11px] text-muted">
          Returns and exchanges within {s.returns.windowDays} days with this receipt.{s.returns.finalSale.length > 0 && ` ${s.returns.finalSale.join(", ")} are final sale unless faulty.`}
        </p>
      )}
      {r.showQr && (
        <div className="mt-3">
          <QR />
          <p className="mt-1 text-center text-[10px] text-muted">Scan to view or return this order</p>
        </div>
      )}
      {r.footer && <p className="mt-3 text-center font-sans text-[11px]">{r.footer}</p>}
    </div>
  );
}

function L({ a, b, muted }: { a: string; b: string; muted?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-3", muted && "text-muted")}>
      <span className="min-w-0">{a}</span>
      <span className="shrink-0">{b}</span>
    </div>
  );
}

export function ReturnSlip({ order, ret }: { order: Order; ret: ReturnRec }) {
  return (
    <div className="print-area tnum mx-auto max-w-[320px] rounded-lg border border-line bg-white px-5 py-5 font-mono text-[12px] leading-[1.55]" data-testid="return-slip">
      <p className="text-center font-sans text-[17px] font-semibold tracking-[0.22em]">ASL ORIGINALS</p>
      <p className="mb-2 text-center font-sans text-[12px] font-semibold uppercase tracking-wider">{ret.kind === "exchange" ? "Exchange slip" : "Refund slip"}</p>
      <div className="border-y border-dashed border-line-strong py-2">
        <L a="Slip" b={ret.number} />
        <L a="Original" b={order.number} />
        <L a="Date" b={`${fmtDate(ret.createdAt)} ${fmtTime(ret.createdAt)}`} />
        <L a="Reason" b={ret.reason} />
        {ret.exchangeOrder && <L a="New receipt" b={ret.exchangeOrder} />}
      </div>
      <div className="py-2">
        {ret.lines.map((l) => (
          <div key={l.lineIndex}>
            <L a={`${l.qty} × ${order.lines[l.lineIndex].name}`} b={naira(l.amount)} />
            <p className="text-[11px] text-muted">{l.restock ? "Back in stock" : "Not restocked"}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-line-strong pt-2">
        <div className="flex justify-between font-sans text-[15px] font-semibold">
          <span>Returned</span>
          <span>{naira(ret.amount)}</span>
        </div>
        {ret.refunds.map((p, i) => (
          <L key={i} a={`Refunded to ${methodText(p.method)}`} b={naira(p.amount)} />
        ))}
      </div>
    </div>
  );
}
