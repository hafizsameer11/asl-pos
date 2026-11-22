import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, Banknote, CalendarClock, Check, CreditCard, Gift, Landmark, Mail, MessageCircle, Printer, Scissors, Smartphone, Trash2, Truck, Wallet } from "lucide-react";
import { liveMode } from "../api/client";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import type { GiftCard, Order, PayMethod, Payment, ReturnRec } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Field, Input, Row, Toggle, cx, fmtDate, toast } from "../ui/kit";
import { METHOD, methodText, Receipt, ReturnSlip } from "../shared/Receipt";
import { completeSale, useQuote } from "./common";

const ICON: Record<string, typeof Banknote> = { cash: Banknote, card: CreditCard, transfer: Landmark, wallet: Wallet, giftcard: Gift };

export default function Pay({ onClose }: { onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const offline = useTill((s) => s.offline);
  const db = useDb();
  const customer = db.customers.find((c) => c.id === cart.customerId);
  const ps = db.settings.payments;
  const svc = db.settings.services;
  const methods = (["cash", "card", "transfer", "wallet", "giftcard"] as const).filter((m) => (m === "giftcard" ? svc.giftCards : ps[m]) && (m !== "wallet" || (customer && customer.walletBalance > 0)));
  const [tenders, setTenders] = useState<Payment[]>([]);
  const [cashGiven, setCashGiven] = useState(0);
  const [method, setMethod] = useState<PayMethod>(methods[0] ?? "cash");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [refundMethod, setRefundMethod] = useState<PayMethod>("cash");
  const [reserve, setReserve] = useState(false);
  const q = useQuote(cart, reserve ? "layaway" : undefined);
  const [done, setDone] = useState<{ order: Order; ret?: ReturnRec; change: number; giftCodes: string[] } | null>(null);

  const due = q.due;
  const paid = tenders.reduce((a, t) => a + t.amount, 0);
  const remaining = Math.max(0, due - paid);
  const typed = Number(amount.replace(/\D/g, "")) || 0;
  // Reservation: a deposit now, the rest on collection. Not for gift cards, deliveries or exchanges.
  const canReserve = svc.layaway && cart.lines.length > 0 && !cart.exchange && !cart.giftCards?.length && !cart.lines.some((l) => l.shipFrom) && due > 0;
  const minDeposit = Math.ceil((due * svc.minDepositPct) / 100 / 1000) * 1000;
  const depositLeft = Math.max(0, minDeposit - paid);
  const value = ps.split ? typed || (reserve && depositLeft ? depositLeft : remaining) : remaining;
  const change = Math.max(0, cashGiven - tenders.filter((t) => t.method === "cash").reduce((a, t) => a + t.amount, 0));
  const creditAvail = (customer?.walletBalance ?? 0) - tenders.filter((t) => t.method === "wallet").reduce((a, t) => a + t.amount, 0);
  const tooBigOffline = offline && (!db.settings.offline.allowed || q.total > db.settings.offline.maxSale);
  const [liveCard, setLiveCard] = useState<GiftCard | null>(null);
  const [cardLookup, setCardLookup] = useState<"idle" | "loading" | "miss">("idle");
  useEffect(() => {
    const code = ref.trim();
    if (method !== "giftcard" || code.length < 4) {
      setLiveCard(null);
      setCardLookup("idle");
      return;
    }
    if (!liveMode()) {
      setLiveCard(null);
      setCardLookup("idle");
      return;
    }
    let cancelled = false;
    setCardLookup("loading");
    const t = window.setTimeout(() => {
      posApi
        .giftCard(code)
        .then((g) => {
          if (cancelled) return;
          setLiveCard({
            code: g.code,
            initial: g.initial,
            balance: g.balance,
            issuedAt: g.issuedAt ?? new Date().toISOString(),
            expires: g.expiresAt ?? g.expires ?? new Date(Date.now() + 365 * 86400e3).toISOString(),
            status: g.status,
            history: g.history ?? [],
          } as GiftCard);
          setCardLookup("idle");
        })
        .catch(() => {
          if (cancelled) return;
          setLiveCard(null);
          setCardLookup("miss");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [ref, method]);
  const localCard = useMemo(() => db.giftCards.find((g) => g.code.replace(/\W/g, "") === ref.toUpperCase().replace(/\W/g, "")), [db.giftCards, ref]);
  const card = liveMode() ? liveCard : localCard;
  const cardUsed = card ? tenders.filter((t) => t.method === "giftcard" && t.reference === card.code).reduce((a, t) => a + t.amount, 0) : 0;
  const cardAvail = card && card.status === "active" && new Date(card.expires) > new Date() ? card.balance - cardUsed : 0;
  const cap = method === "wallet" ? creditAvail : method === "giftcard" ? cardAvail : Infinity;

  const record = (v: number) => {
    if (v <= 0) return;
    const applied = Math.min(v, remaining, cap);
    if (method === "cash") setCashGiven((c) => c + v);
    setTenders((t) => [...t, { method, amount: applied, reference: method === "giftcard" ? card?.code : ref.trim() || undefined }]);
    setAmount("");
    setRef("");
  };

  const finish = async () => {
    try {
      const r = await completeSale(tenders, change, due < 0 ? refundMethod : undefined, { reserve: reserve && remaining > 0 });
      setDone({ ...r, change });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sale failed");
    }
  };

  if (done) return <Done order={done.order} ret={done.ret} change={done.change} giftCodes={done.giftCodes} onClose={onClose} />;

  const overpay = method !== "cash" && typed > remaining;
  const needsRef = (method === "transfer" && ps.transferNeedsRef && !ref.trim()) || (method === "giftcard" && cardAvail <= 0);
  const reserving = reserve && remaining > 0;
  const ready = due < 0 || remaining === 0 || (reserving && paid >= minDeposit);
  const target = reserving && depositLeft > 0 ? depositLeft : remaining;
  const quick = [...new Set([target, ...ps.quickTender.filter((v) => v > target).slice(0, 3), Math.ceil(target / 10000) * 10000])].filter((v) => v > 0).sort((a, b) => a - b).slice(0, 5);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas md:flex-row" role="dialog" aria-modal="true" aria-label="Take payment">
      <aside className="flex max-h-[38%] flex-col border-b border-line bg-white md:max-h-none md:w-[380px] md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={onClose}>
            Back to sale
          </Button>
        </div>
        <ul className="thin-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {cart.lines.map((l, i) => {
            const p = db.products.find((x) => x.id === l.productId)!;
            const v = p.variants.find((x) => x.id === l.variantId)!;
            return (
              <li key={l.key} className="flex items-center gap-3 px-4 py-2.5">
                <img src={p.image} alt="" className="h-12 w-10 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="text-xs text-muted">
                    {v.colour}
                    {v.size !== "One Size" && ` · ${v.size}`} × {l.qty}
                  </span>
                </span>
                <span className="tnum text-[13px] font-medium">{naira(q.lines[i].net)}</span>
              </li>
            );
          })}
        </ul>
        <div className="tnum space-y-1 border-t border-line p-4 text-[13px]">
          <Row label="Subtotal" value={naira(q.subtotal)} muted />
          {q.discountTotal > 0 && <Row label="Discounts" value={naira(-q.discountTotal)} className="text-gold-ink" />}
          {q.credit > 0 && <Row label="Exchange credit" value={naira(-q.credit)} className="text-gold-ink" />}
          <Row label="Total" value={naira(q.due)} strong className="pt-1 text-base" />
          {customer && <p className="pt-1 text-xs text-muted">{customer.name} · earns {q.earn.toLocaleString()} points</p>}
        </div>
      </aside>

      <section className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-10">
          <p className="text-sm text-muted">{due < 0 ? "Refund to customer" : remaining === 0 ? "Paid" : "Left to pay"}</p>
          <p className="tnum text-[52px] font-semibold leading-tight tracking-tight" data-testid="remaining">
            {naira(due < 0 ? -due : remaining)}
          </p>
          {tooBigOffline && <p className="mt-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">This till is offline and the sale is over the {naira(db.settings.offline.maxSale)} offline limit set in the admin. Reconnect to finish it.</p>}
          {canReserve && remaining > 0 && (
            <div className={cx("mt-5 rounded-xl border p-4", reserve ? "border-gold bg-gold-soft" : "border-line bg-white")}>
              <Toggle
                label="Reserve with a deposit"
                description={customer ? `At least ${svc.minDepositPct}% now (${naira(minDeposit)}). The items are set aside for ${svc.holdDays} days while ${customer.name.split(" ")[0]} pays the rest.` : "Add a customer to the sale to set items aside on a deposit."}
                checked={reserve}
                disabled={!customer}
                onChange={setReserve}
              />
              {reserve && <p className="tnum mt-2 text-[13px] font-medium text-gold-ink">{depositLeft > 0 ? `Take at least ${naira(depositLeft)} more as the deposit` : `Deposit covered. ${naira(remaining)} will be due by ${fmtDate(new Date(Date.now() + svc.holdDays * 86400e3).toISOString())}.`}</p>}
            </div>
          )}

          {due < 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">The returned items are worth more. Refund the difference by</p>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "transfer", "wallet"] as const).map((m) => (
                  <MethodTile key={m} m={m} on={refundMethod === m} onClick={() => setRefundMethod(m)} />
                ))}
              </div>
            </div>
          ) : remaining > 0 ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {methods.map((m) => (
                  <MethodTile key={m} m={m} on={method === m} onClick={() => (setMethod(m), setAmount(""))} sub={m === "wallet" ? naira(creditAvail) : undefined} />
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-line bg-white p-5 shadow-card">
                {method === "cash" && (
                  <>
                    <p className="mb-2 text-[13px] font-medium text-ink-2">Cash received</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {quick.map((v, i) => (
                        <Button key={v} size="lg" onClick={() => record(v)} className="tnum px-2" data-testid={i === 0 ? "exact-cash" : undefined}>
                          {i === 0 ? (target !== remaining ? `Deposit ${naira(v)}` : "Exact") : naira(v)}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                {method === "card" && <p className="rounded-lg bg-canvas p-3 text-[13px] text-ink-2">Charge {naira(value)} on the {db.settings.payments.cardProvider} terminal, then enter the approval code from the slip.</p>}
                {method === "transfer" && (
                  <div className="rounded-lg bg-canvas p-3 text-[13px]">
                    <p className="mb-1 text-ink-2">Ask the customer to send {naira(value)} to:</p>
                    {ps.transferAccounts.map((a) => (
                      <p key={a.number} className="tnum font-medium">
                        {a.bank} · {a.number} · {a.name}
                      </p>
                    ))}
                    <p className="mt-1 text-muted">Check it has arrived in the bank app before recording it.</p>
                  </div>
                )}
                {method === "wallet" && <p className="rounded-lg bg-canvas p-3 text-[13px] text-ink-2">{customer?.name} has {naira(creditAvail)} in their ASL Wallet.</p>}
                {method === "giftcard" && (
                  <div className="rounded-lg bg-canvas p-3 text-[13px]">
                    <p className="text-ink-2">Scan the gift card or type its code. Cards from the website and app work here too.</p>
                    {cardLookup === "loading" && <p className="mt-1 text-muted">Checking card…</p>}
                    {ref.trim() && !card && cardLookup !== "loading" && <p className="mt-1 text-bad">No gift card with that code.</p>}
                    {card && <p className={cx("tnum mt-1 font-medium", cardAvail > 0 ? "text-good" : "text-bad")}>{cardAvail > 0 ? `${card.code} · ${naira(cardAvail)} available · expires ${fmtDate(card.expires)}` : card.status === "cancelled" ? "This card was cancelled." : new Date(card.expires) <= new Date() ? "This card has expired." : "Nothing left on this card."}</p>}
                    {!ref.trim() && !liveMode() && <p className="mt-1 text-faint">Sample: {db.giftCards.find((g) => g.status === "active")?.code}</p>}
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ps.split && (
                    <Field label={method === "cash" ? "Other amount" : "Amount"}>
                      <Input aria-label={method === "cash" ? "Other amount" : "Amount"} prefix="₦" inputMode="numeric" className="tnum" placeholder={remaining.toLocaleString("en-NG")} value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("en-NG") : ""} onChange={(e) => setAmount(e.target.value)} />
                    </Field>
                  )}
                  {(method === "card" || method === "transfer" || method === "giftcard") && (
                    <Field label={method === "card" ? "Approval code" : method === "giftcard" ? "Gift card code" : `Sender's name or reference${ps.transferNeedsRef ? "" : " (optional)"}`}>
                      <Input aria-label={method === "card" ? "Approval code" : method === "giftcard" ? "Gift card code" : "Transfer reference"} className={method === "giftcard" ? "font-mono uppercase" : undefined} value={ref} onChange={(e) => setRef(e.target.value)} />
                    </Field>
                  )}
                </div>
                {overpay && <p className="mt-2 text-[13px] text-bad">Can't take more than {naira(remaining)} by {methodText(method)}.</p>}
                <Button variant="primary" size="lg" className="mt-4 w-full" disabled={overpay || needsRef || (method === "wallet" && creditAvail <= 0)} onClick={() => record(value)} data-testid="record-payment">
                  Record {methodText(method)} · {naira(Math.min(value, remaining, cap))}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-good-soft p-5 text-good">
              <Check size={22} />
              <div>
                <p className="font-semibold">Fully paid</p>
                {change > 0 && <p className="tnum">Give {naira(change)} change</p>}
              </div>
            </div>
          )}

          {tenders.length > 0 && (
            <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
              {tenders.map((t, i) => (
                <li key={i} className="tnum flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Badge>{METHOD[t.method]}</Badge>
                  {t.reference && <span className="text-xs text-muted">{t.reference}</span>}
                  <span className="ml-auto font-medium">{naira(t.amount)}</span>
                  <button
                    aria-label="Remove payment"
                    onClick={() => {
                      setTenders(tenders.filter((_, j) => j !== i));
                      if (t.method === "cash") setCashGiven(0);
                    }}
                    className="text-faint hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
              {change > 0 && (
                <li className="tnum flex justify-between px-4 py-2.5 text-sm font-medium text-good">
                  <span>Change</span>
                  <span>{naira(change)}</span>
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <div className="mx-auto max-w-2xl">
            <Button variant="gold" size="xl" className="w-full" disabled={!ready || tooBigOffline} onClick={finish} data-testid="complete">
              {reserving ? (paid >= minDeposit ? `Set aside · ${naira(paid)} deposit` : `${naira(depositLeft)} more for the deposit`) : due >= 0 && remaining > 0 ? `${naira(remaining)} still to pay` : due < 0 ? `Refund ${naira(-due)} and complete` : "Complete sale"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MethodTile({ m, on, onClick, sub }: { m: PayMethod; on: boolean; onClick: () => void; sub?: string }) {
  const Icon = ICON[m];
  return (
    <button onClick={onClick} aria-pressed={on} className={cx("flex h-[76px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-line-strong")}>
      <Icon size={21} />
      {METHOD[m]}
      {sub && <span className={cx("tnum text-[11px] font-normal", on ? "text-white/70" : "text-muted")}>{sub}</span>}
    </button>
  );
}

function Done({ order, ret, change, giftCodes, onClose }: { order: Order; ret?: ReturnRec; change: number; giftCodes: string[]; onClose: () => void }) {
  const r = useDb((s) => s.settings.receipts);
  const customer = useDb((s) => s.customers.find((c) => c.id === order.customerId));
  const allAlterations = useDb((s) => s.alterations);
  const tickets = useMemo(() => allAlterations.filter((a) => a.orderNumber === order.number), [allAlterations, order.number]);
  const stores = useDb((s) => s.stores);
  const offline = useTill((s) => s.offline);
  const [gift, setGift] = useState(false);
  const res = order.reservation;
  const del = order.delivery;
  const send = async (how: "email" | "sms" | "whatsapp", to?: string) => {
    try {
      const { liveMode } = await import("../api/client");
      const { posApi } = await import("../api/pos");
      if (liveMode()) {
        const out = await posApi.sendReceipt(order.id, how, false, to);
        toast((out as { note?: string }).note ?? (to ? `Receipt sent by ${how} to ${to}` : `Receipt ${how}`));
        return;
      }
      toast(to ? `Receipt sent by ${how} to ${to}` : `Receipt ${how}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send receipt");
    }
  };
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label="Sale complete">
      <div className="mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-[1fr_340px] md:p-10">
        <div>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
            <Check size={28} />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{res ? "Items set aside" : "Sale complete"}</h1>
          <p className="mt-1 text-muted">
            {order.number} · {naira(order.total)}
            {offline && " · saved on this till, will sync when back online"}
          </p>
          {change > 0 && (
            <div className="mt-6 rounded-xl border border-good/20 bg-good-soft p-5" data-testid="change-due">
              <p className="text-sm text-good">Give change</p>
              <p className="tnum text-4xl font-semibold text-good">{naira(change)}</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {res && (
              <Note icon={<CalendarClock size={18} />} testId="done-layaway">
                Reservation: <b>{naira(res.deposit)}</b> deposit taken. <b>{naira(res.balance)}</b> to pay by {fmtDate(res.until)}. Put the items in the layaway rail with the receipt. Take the balance from Services.
              </Note>
            )}
            {giftCodes.map((code, i) => (
              <Note key={code} icon={<Gift size={18} />} testId="done-giftcard">
                Gift card <b className="font-mono">{code}</b> · {naira(order.extras?.filter((x) => x.kind === "giftcard")[i]?.amount ?? 0)} · ready to use in store, online and in the app.
              </Note>
            ))}
            {tickets.map((t) => (
              <Note key={t.id} icon={<Scissors size={18} />}>
                Alteration ticket <b>{t.number}</b> · {t.work.join(", ")} · ready {fmtDate(t.readyBy)}. Tag the garment and send it to {t.tailor}.
              </Note>
            ))}
            {del && (
              <Note icon={<Truck size={18} />}>
                Ships from {stores.find((s) => s.id === del.fromStoreId)?.name} to {del.address}, {del.city}. Expected {fmtDate(del.eta)}. {del.name.split(" ")[0]} gets tracking by SMS.
              </Note>
            )}
          </div>
          {order.pointsEarned > 0 && customer && (
            <p className="mt-4 rounded-lg bg-gold-soft px-4 py-3 text-sm text-gold-ink">
              {customer.name.split(" ")[0]} earned {order.pointsEarned.toLocaleString()} points. New balance {customer.loyaltyPoints.toLocaleString()}.
            </p>
          )}
          <p className="mb-2 mt-8 text-sm font-medium">Receipt</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {r.channels.print && (
              <Button size="lg" icon={<Printer size={17} />} onClick={() => window.print()}>
                Print
              </Button>
            )}
            {r.channels.email && (
              <Button size="lg" icon={<Mail size={17} />} disabled={!customer?.email} onClick={() => void send("email", customer?.email)}>
                Email
              </Button>
            )}
            {r.channels.sms && (
              <Button size="lg" icon={<Smartphone size={17} />} disabled={!customer} onClick={() => void send("sms", customer?.phone)}>
                SMS
              </Button>
            )}
            {r.channels.whatsapp && (
              <Button size="lg" icon={<MessageCircle size={17} />} disabled={!customer} onClick={() => void send("whatsapp", customer?.phone)}>
                WhatsApp
              </Button>
            )}
          </div>
          {r.giftReceipts && (
            <div className="mt-3 max-w-sm">
              <Toggle label="Gift receipt (no prices)" checked={gift} onChange={setGift} />
            </div>
          )}
          <Button variant="primary" size="xl" className="mt-8 w-full sm:w-72" onClick={onClose} data-testid="new-sale">
            New sale
          </Button>
        </div>
        <div className="space-y-4">
          <Receipt order={order} gift={gift} className="shadow-card" />
          {ret && <ReturnSlip order={useDb.getState().orders.find((o) => o.number === order.exchangeFrom) ?? order} ret={ret} />}
        </div>
      </div>
    </div>
  );
}

function Note({ icon, children, testId }: { icon: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-[13.5px]" data-testid={testId}>
      <span className="mt-0.5 text-gold">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
