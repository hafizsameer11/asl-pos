import { useEffect, useState } from "react";
import { ArrowLeftRight, BadgePercent, Clock, Crown, Gift, Heart, MoreHorizontal, Pause, Scissors, Search, StickyNote, Tag, Ticket, Trash2, Truck, UserCheck, UserPlus, X, Sparkles } from "lucide-react";
import { liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { posApi } from "../api/pos";
import { emptyCart, findVariant, uid, useDb, useTill, type CartLine, type DeliveryDraft } from "../data/store";
import type { Customer, GiftCard, Product } from "../data/types";
import { discountOf, isBirthdayMonth, naira, percentOff, type Disc } from "../lib/pricing";
import { Avatar, Badge, Button, Dialog, Empty, Field, Input, Row, SearchBox, Segmented, Select, TierBadge, cx, fmtDate, fmtTime, toast } from "../ui/kit";
import { approve, approvePerm, auditHere, useMe, useQuote, useRegister } from "./common";
import { ConciergeDialog } from "./ConciergeDialog";
import { AlterationDialog } from "./AlterationDialog";
import { ProductDialog } from "./ProductDialog";
import Pay from "./Pay";

type CartDialog = null | "customer" | "code" | "points" | "discount" | "held" | "note" | "more" | "giftcard" | "balance" | "alteration" | "delivery" | "associate" | "wishlist" | "concierge" | { line: string };

export default function Cart() {
  const cart = useTill((s) => s.cart);
  const held = useTill((s) => s.held);
  const patch = useTill((s) => s.patchCart);
  const db = useDb();
  const me = useMe()!;
  const q = useQuote(cart);
  const customer = db.customers.find((c) => c.id === cart.customerId);
  const [dialog, setDialog] = useState<CartDialog>(null);
  const [paying, setPaying] = useState(false);
  const [viewing, setViewing] = useState<Product | null>(null);
  const loyalty = db.settings.loyalty;
  const svc = db.settings.services;
  const { store } = useRegister();
  const associate = db.staff.find((s) => s.id === (cart.associateId ?? me.id));
  const empty = !cart.lines.length && !cart.giftCards?.length && !cart.alterations?.length;
  const shipping = cart.lines.filter((l) => l.shipFrom);
  const wishHere = (customer?.wishlist ?? []).filter((pid) => db.products.find((p) => p.id === pid)?.variants.some((v) => (db.inventory[v.id]?.[store.id] ?? 0) > 0));
  const items = cart.lines.map((l) => {
    const f = findVariant(db.products, l.variantId)!;
    return `${f.product.name} · ${f.variant.colour}${f.variant.size !== "One Size" ? ` ${f.variant.size}` : ""}`;
  });

  const hold = () => {
    const label = customer?.name ?? `${cart.lines.length} item sale`;
    useTill.setState({ held: [{ id: uid(), at: new Date().toISOString(), label, cart, staffId: me.id }, ...held], cart: emptyCart() });
    toast("Sale parked. Resume it from Held.");
  };

  const clear = async () => {
    const who = await approvePerm("voidSale", "Clear this sale?", "Clearing a sale with items in it needs approval.");
    if (!who) return;
    auditHere("void", `Cleared a sale with ${cart.lines.reduce((a, l) => a + l.qty, 0)} items (${naira(q.total)})`, { amount: q.total, approvedBy: who.id });
    patch(emptyCart());
    setDialog(null);
  };

  const charge = () => {
    const need = db.settings.general.requireCustomerOver;
    if (need && q.total > need && !customer) {
      toast(`Add a customer for sales over ${naira(need)}`, "bad");
      setDialog("customer");
      return;
    }
    if (shipping.length && !cart.delivery) {
      toast("Add the delivery address first", "info");
      setDialog("delivery");
      return;
    }
    setPaying(true);
  };

  return (
    <div className="flex min-h-0 w-full flex-col">
      {cart.exchange && (
        <div className="flex items-start gap-2 border-b border-gold/25 bg-gold-soft px-4 py-3 text-[13px] text-gold-ink">
          <ArrowLeftRight size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">
            <b>Exchange</b> for {cart.exchange.number}. Add the new items. <span className="tnum font-semibold">{naira(cart.exchange.credit)}</span> credit.
          </p>
          <button onClick={() => patch({ exchange: undefined })} className="font-medium underline">
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {customer ? (
          <button onClick={() => setDialog("customer")} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="cart-customer">
            <Avatar name={customer.name} size={38} />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{customer.name}</span>
                <TierBadge tier={customer.tier} />
              </span>
              <span className="tnum block text-xs text-muted">
                {customer.loyaltyPoints.toLocaleString()} pts ({naira(customer.loyaltyPoints * loyalty.pointValue)}){customer.walletBalance > 0 && ` · ${naira(customer.walletBalance)} in ASL Wallet`}
              </span>
            </span>
          </button>
        ) : (
          <button onClick={() => setDialog("customer")} className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 text-sm font-medium text-ink-2 hover:bg-canvas">
            <UserPlus size={17} />
            Add customer
            <span className="ml-auto text-xs font-normal text-faint">for points and receipts</span>
          </button>
        )}
        {customer && (
          <button aria-label="Remove customer" onClick={() => patch({ customerId: undefined, pointsToUse: 0 })} className="flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-canvas hover:text-ink">
            <X size={16} />
          </button>
        )}
        <button aria-label="Held sales" onClick={() => setDialog("held")} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-canvas">
          <Clock size={18} />
          {held.length > 0 && <span className="tnum absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white">{held.length}</span>}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[12.5px]">
        <button onClick={() => setDialog("associate")} className="inline-flex items-center gap-1.5 text-muted hover:text-ink" data-testid="associate">
          <UserCheck size={14} />
          Sales credit: <span className="font-medium text-ink">{associate?.name.split(" ")[0]}</span>
        </button>
        {customer && wishHere.length > 0 && (
          <button onClick={() => setDialog("wishlist")} className="inline-flex items-center gap-1.5 font-medium text-gold-ink hover:underline">
            <Heart size={13} />
            {wishHere.length} wishlist {wishHere.length === 1 ? "item" : "items"} in store
          </button>
        )}
        {customer && isBirthdayMonth(customer) && <span className="text-gold-ink">Birthday this month</span>}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <Empty icon={<Tag size={20} />} title="No items yet" body="Scan a barcode or tap a product. Gift cards and alterations are under More." />
        ) : (
          <ul className="divide-y divide-line">
            {cart.lines.map((l, i) => {
              const f = findVariant(db.products, l.variantId)!;
              const line = q.lines[i];
              return (
                <li key={l.key}>
                  <button onClick={() => setDialog({ line: l.key })} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas/70" data-testid="cart-line">
                    <img src={f.product.image} alt="" className="h-14 w-11 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{f.product.name}</span>
                      <span className="block text-xs text-muted">
                        {f.variant.colour}
                        {f.variant.size !== "One Size" && ` · ${f.variant.size}`} · <span className="tnum">{naira(l.unitPrice)}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {l.discount && <Badge tone="gold">{l.discount.type === "percent" ? `${l.discount.value}% off` : `${naira(l.discount.value)} off`}</Badge>}
                        {line.promo > 0 && <Badge tone="gold">Offer −{naira(line.promo)}</Badge>}
                        {l.unitPrice !== l.listPrice && <Badge tone="info">Price changed</Badge>}
                        {l.shipFrom && (
                          <Badge tone="info">
                            <Truck size={11} className="mr-1" />
                            Ships from {db.stores.find((s) => s.id === l.shipFrom)?.kind === "warehouse" ? "warehouse" : db.stores.find((s) => s.id === l.shipFrom)?.name}
                          </Badge>
                        )}
                        {l.soldBy && l.soldBy !== (cart.associateId ?? me.id) && <Badge>Credit: {db.staff.find((s) => s.id === l.soldBy)?.name.split(" ")[0]}</Badge>}
                        {l.note && <Badge>{l.note}</Badge>}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tnum block text-[13.5px] font-semibold">{naira(line.gross - line.lineDiscount)}</span>
                      {line.lineDiscount > 0 && <span className="tnum block text-xs text-faint line-through">{naira(line.gross)}</span>}
                      <span className="tnum mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-canvas px-1.5 text-xs font-medium">×{l.qty}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {(cart.giftCards ?? []).map((g) => (
              <Extra key={g.key} icon={<Gift size={18} />} title="Gift card" sub="Code is issued when the sale completes" amount={g.amount} onRemove={() => patch({ giftCards: cart.giftCards!.filter((x) => x.key !== g.key) })} />
            ))}
            {(cart.alterations ?? []).map((a) => (
              <Extra key={a.key} icon={<Scissors size={18} />} title={`Alteration · ${a.work.join(", ")}`} sub={`${a.item} · ready ${fmtDate(a.readyBy)}`} amount={a.fee} onRemove={() => patch({ alterations: cart.alterations!.filter((x) => x.key !== a.key) })} />
            ))}
            {shipping.length > 0 && (
              <li>
                <button onClick={() => setDialog("delivery")} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", cart.delivery ? "hover:bg-canvas/70" : "bg-gold-soft text-gold-ink")} data-testid="delivery-line">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-2">
                    <Truck size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{cart.delivery ? `Delivery · ${cart.delivery.zone}` : "Add delivery address"}</span>
                    <span className="block truncate text-xs text-muted">{cart.delivery ? `${cart.delivery.name} · ${cart.delivery.address}, ${cart.delivery.city}` : `${shipping.length} ${shipping.length === 1 ? "item ships" : "items ship"} to the customer`}</span>
                  </span>
                  {cart.delivery && <span className="tnum text-[13.5px] font-semibold">{cart.delivery.fee ? naira(cart.delivery.fee) : "Free"}</span>}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-4 pb-4 pt-3">
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          <Tool icon={<Ticket size={17} />} label="Code" on={!!cart.couponCode} onClick={() => setDialog("code")} disabled={!cart.lines.length || !db.settings.discounts.couponsAtPos} />
          <Tool icon={<Crown size={17} />} label="Points" on={cart.pointsToUse > 0} onClick={() => setDialog("points")} disabled={!customer || !loyalty.redeemAtPos || !cart.lines.length} />
          <Tool icon={<BadgePercent size={17} />} label="Discount" on={!!cart.manual} onClick={() => setDialog("discount")} disabled={!cart.lines.length} />
          <Tool icon={<MoreHorizontal size={17} />} label="More" onClick={() => setDialog("more")} />
        </div>
        <div className="tnum space-y-1 text-[13px]">
          <Row label="Subtotal" value={naira(q.subtotal)} muted />
          {q.promos.map((p) => (
            <Row key={p.id} label={p.label} value={naira(-p.amount)} className="text-gold-ink" />
          ))}
          {q.lineDiscounts > 0 && <Row label="Item discounts" value={naira(-q.lineDiscounts)} className="text-gold-ink" />}
          {cart.couponCode && <Row label={`Code ${cart.couponCode}`} value={q.couponError ? <span className="text-bad">{q.couponError}</span> : naira(-q.coupon)} className="text-gold-ink" />}
          {q.manual > 0 && <Row label={`Discount · ${cart.manual?.reason}`} value={naira(-q.manual)} className="text-gold-ink" />}
          {q.points > 0 && <Row label={`${q.pointsUsed.toLocaleString()} points`} value={naira(-q.points)} className="text-gold-ink" />}
          {q.credit > 0 && <Row label="Exchange credit" value={naira(-q.credit)} className="text-gold-ink" />}
          {q.extras > 0 && <Row label="Gift cards, alterations, delivery" value={naira(q.extras)} muted />}
          <Row label={<span className="text-muted">VAT included ({db.settings.general.vatRate}%)</span>} value={<span className="text-muted">{naira(q.vat)}</span>} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-medium">{q.due < 0 ? "To refund" : "Total"}</span>
          <span className="tnum text-[28px] font-semibold tracking-tight" data-testid="cart-total">
            {naira(Math.abs(q.due))}
          </span>
        </div>
        {customer && q.earn > 0 && (
          <p className="mb-1 text-xs text-muted">
            {customer.name.split(" ")[0]} earns <b className="text-gold-ink">{q.earn.toLocaleString()} points</b> on this sale
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button size="xl" onClick={hold} disabled={!cart.lines.length || !!cart.exchange} aria-label="Park sale">
            <Pause size={18} />
          </Button>
          <Button variant="primary" size="xl" className="flex-1" disabled={empty || !!q.couponError} onClick={charge} data-testid="charge">
            {q.due < 0 ? "Settle exchange" : `Charge ${naira(q.due)}`}
          </Button>
        </div>
      </div>

      {dialog === "customer" && <CustomerPicker onClose={() => setDialog(null)} />}
      {dialog === "code" && <CodeDialog onClose={() => setDialog(null)} />}
      {dialog === "points" && customer && <PointsDialog customer={customer} max={Math.min(customer.loyaltyPoints, Math.floor((q.total + q.points) / loyalty.pointValue))} onClose={() => setDialog(null)} />}
      {dialog === "discount" && <DiscountDialog base={q.subtotal - q.lineDiscounts - q.promoTotal - q.coupon} current={cart.manual} onApply={(d) => patch({ manual: d })} onClose={() => setDialog(null)} title="Discount the whole sale" />}
      {dialog === "held" && <HeldDialog onClose={() => setDialog(null)} />}
      {dialog === "more" && (
        <Dialog title="More" size="sm" onClose={() => setDialog(null)}>
          <div className="space-y-2">
            {svc.giftCards && (
              <>
                <Button className="w-full justify-start" icon={<Gift size={16} />} onClick={() => setDialog("giftcard")} data-testid="sell-gift-card">
                  Sell a gift card
                </Button>
                <Button className="w-full justify-start" icon={<Search size={16} />} onClick={() => setDialog("balance")}>
                  Check a gift card balance
                </Button>
              </>
            )}
            {svc.alterations && (
              <Button className="w-full justify-start" icon={<Scissors size={16} />} onClick={() => setDialog("alteration")} data-testid="book-alteration">
                Book an alteration
              </Button>
            )}
            <Button className="w-full justify-start" icon={<Sparkles size={16} />} onClick={() => setDialog("concierge")} data-testid="start-concierge">
              Start a concierge request
            </Button>
            <Button className="w-full justify-start" icon={<StickyNote size={16} />} disabled={!cart.lines.length} onClick={() => setDialog("note")}>
              Add a note to the sale
            </Button>
            <Button className="w-full justify-start" variant="danger" icon={<Trash2 size={16} />} disabled={empty} onClick={clear}>
              Clear sale
            </Button>
          </div>
        </Dialog>
      )}
      {dialog === "note" && <NoteDialog onClose={() => setDialog(null)} />}
      {dialog === "concierge" && <ConciergeDialog onClose={() => setDialog(null)} />}
      {dialog === "giftcard" && <GiftCardSaleDialog onClose={() => setDialog(null)} />}
      {dialog === "balance" && <GiftCardBalanceDialog onClose={() => setDialog(null)} />}
      {dialog === "alteration" && <AlterationDialog items={items} saleTotal={q.total - q.extras} onSave={(d) => patch({ alterations: [...(cart.alterations ?? []), d] })} onClose={() => setDialog(null)} />}
      {dialog === "delivery" && <DeliveryDialog goods={q.total - q.extras} onClose={() => setDialog(null)} />}
      {dialog === "associate" && <AssociateDialog onClose={() => setDialog(null)} />}
      {dialog === "wishlist" && customer && (
        <WishlistDialog
          customer={customer}
          onOpen={(p) => {
            setDialog(null);
            setViewing(p);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {viewing && <ProductDialog product={viewing} onClose={() => setViewing(null)} />}
      {typeof dialog === "object" && dialog?.line && <LineDialog lineKey={dialog.line} onClose={() => setDialog(null)} />}
      {paying && <Pay onClose={() => setPaying(false)} />}
    </div>
  );
}

function Tool({ icon, label, on, onClick, disabled }: { icon: React.ReactNode; label: string; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cx("flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border text-[11.5px] font-medium transition-colors disabled:opacity-35", on ? "border-gold bg-gold-soft text-gold-ink" : "border-line text-ink-2 hover:bg-canvas")}>
      {icon}
      {label}
    </button>
  );
}

/* ---------- Line editing ---------- */

function LineDialog({ lineKey, onClose }: { lineKey: string; onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const db = useDb();
  const l = cart.lines.find((x) => x.key === lineKey);
  const [price, setPrice] = useState(String(l?.unitPrice ?? 0));
  const [note, setNote] = useState(l?.note ?? "");
  const [disc, setDisc] = useState(false);
  if (!l) return null;
  const f = findVariant(db.products, l.variantId)!;
  const update = (p: Partial<CartLine>) => patch({ lines: cart.lines.map((x) => (x.key === lineKey ? { ...x, ...p } : x)) });
  const storeId = db.registers.find((r) => r.id === useTill.getState().registerId)!.storeId;
  const here = db.inventory[l.variantId]?.[storeId] ?? 0;
  const team = db.staff.filter((s) => s.active && s.storeIds.includes(storeId));

  if (disc) return <DiscountDialog title={`Discount on ${f.product.name}`} base={l.qty * l.unitPrice} current={l.discount} onApply={(d) => update({ discount: d })} onClose={onClose} />;

  return (
    <Dialog
      title={f.product.name}
      sub={`${f.variant.colour}${f.variant.size !== "One Size" ? ` · ${f.variant.size}` : ""} · ${f.variant.sku} · ${here} in store`}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            icon={<Trash2 size={16} />}
            onClick={() => {
              patch({ lines: cart.lines.filter((x) => x.key !== lineKey) });
              onClose();
            }}
          >
            Remove
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const p = Number(price.replace(/\D/g, "")) || 0;
              if (p !== l.unitPrice) {
                const who = await approvePerm("priceOverride", "Change the price?", `${naira(l.unitPrice)} to ${naira(p)} needs a supervisor or manager.`);
                if (!who) return;
                auditHere("price", `Price of ${f.product.name} changed ${naira(l.unitPrice)} → ${naira(p)}`, { amount: Math.abs(l.unitPrice - p) * l.qty, approvedBy: who.id, ref: f.variant.sku });
                update({ unitPrice: p, overrideBy: who.id, note: note || undefined });
              } else update({ note: note || undefined });
              onClose();
            }}
          >
            Done
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <img src={f.product.image} alt="" className="h-24 w-20 rounded-lg object-cover" />
        <div className="flex-1">
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Quantity</p>
          <div className="inline-flex items-center rounded-lg border border-line">
            <button aria-label="Fewer" onClick={() => update({ qty: Math.max(1, l.qty - 1) })} className="h-11 w-12 text-lg">
              −
            </button>
            <span className="tnum w-10 text-center text-lg font-semibold">{l.qty}</span>
            <button aria-label="More" onClick={() => update({ qty: l.qty + 1 })} className="h-11 w-12 text-lg">
              +
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Price each" hint={l.unitPrice !== l.listPrice ? `List price ${naira(l.listPrice)}` : "Changing it needs approval"}>
          <Input prefix="₦" inputMode="numeric" className="tnum" value={Number(price.replace(/\D/g, "") || 0).toLocaleString("en-NG")} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Item discount">
          <Button className="w-full" icon={<BadgePercent size={16} />} onClick={() => setDisc(true)}>
            {l.discount ? (l.discount.type === "percent" ? `${l.discount.value}% off` : `${naira(l.discount.value)} off`) : "Add discount"}
          </Button>
        </Field>
        <Field label="Sales credit" hint="Who helped the customer with this item">
          <Select aria-label="Sales credit for this item" value={l.soldBy ?? cart.associateId ?? useTill.getState().staffId ?? ""} onChange={(e) => update({ soldBy: e.target.value })}>
            {team.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Gift wrap" />
        </Field>
      </div>
    </Dialog>
  );
}

/* ---------- Discounts with role limits ---------- */

export function DiscountDialog({ title, base, current, onApply, onClose }: { title: string; base: number; current?: Disc; onApply: (d?: Disc) => void; onClose: () => void }) {
  const db = useDb();
  const me = useMe()!;
  const reasons = db.settings.discounts.reasons;
  const [type, setType] = useState<Disc["type"]>(current?.type ?? "percent");
  const [value, setValue] = useState(current ? String(current.value) : "");
  const [reason, setReason] = useState(current?.reason ?? reasons[0] ?? "");
  const d: Disc = { type, value: Number(value) || 0, reason };
  const pct = percentOff(base, d);
  const limit = db.settings.discounts.limits[me.role];
  const over = pct > limit + 0.001;

  return (
    <Dialog
      title={title}
      sub={`Your limit is ${limit}% without approval.`}
      onClose={onClose}
      footer={
        <>
          {current && (
            <Button
              className="mr-auto"
              onClick={() => {
                onApply(undefined);
                onClose();
              }}
            >
              Remove discount
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!d.value || (type === "percent" && d.value > 100) || (db.settings.discounts.requireReason && !reason)}
            onClick={async () => {
              if (over) {
                const who = await approve("Approve this discount", `${pct.toFixed(0)}% is over ${me.name.split(" ")[0]}'s ${limit}% limit.`, (s) => db.settings.discounts.limits[s.role] >= pct);
                if (!who) return;
                auditHere("discount", `${title}: ${pct.toFixed(0)}% (${reason}), over ${me.name.split(" ")[0]}'s ${limit}% limit`, { amount: discountOf(base, d), approvedBy: who.id });
              } else if (pct >= 15) auditHere("discount", `${title}: ${pct.toFixed(0)}% (${reason})`, { amount: discountOf(base, d) });
              onApply(d);
              onClose();
            }}
          >
            {over ? "Ask for approval" : "Apply"} · {naira(Math.min(base, type === "percent" ? Math.round((base * d.value) / 100) : d.value))} off
          </Button>
        </>
      }
    >
      <Segmented value={type} onChange={(t) => (setType(t), setValue(""))} options={[{ value: "percent", label: "Percent" }, { value: "amount", label: "Amount" }]} />
      {type === "percent" && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {[5, 10, 15, 20, 25].map((n) => (
            <button key={n} onClick={() => setValue(String(n))} className={cx("h-12 rounded-lg border text-sm font-medium", Number(value) === n ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas", n > limit && "text-warn")}>
              {n}%
            </button>
          ))}
        </div>
      )}
      <Field label={type === "percent" ? "Percent off" : "Naira off"} className="mt-4">
        <Input aria-label={type === "percent" ? "Percent off" : "Naira off"} className="tnum" inputMode="numeric" prefix={type === "amount" ? "₦" : undefined} value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} />
      </Field>
      <Field label="Reason" className="mt-4">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      {over && <p className="mt-3 rounded-lg bg-warn-soft p-3 text-[13px] text-warn">This is over your limit, so a supervisor or manager will need to approve it.</p>}
    </Dialog>
  );
}

/* ---------- Customer ---------- */

export function CustomerPicker({ onClose, onPick }: { onClose: () => void; onPick?: (c: Customer) => void }) {
  const db = useDb();
  const patch = useTill((s) => s.patchCart);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [remote, setRemote] = useState<Customer[] | null>(null);
  const t = q.trim().toLowerCase();
  const local = db.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.replace(/\s/g, "").includes(t.replace(/\s/g, "")) || c.email.includes(t)).slice(0, 30);
  const matches = remote ?? local;
  const pick = (c: Customer) => {
    if (!db.customers.some((x) => x.id === c.id)) useDb.setState({ customers: [c, ...db.customers] });
    if (onPick) onPick(c);
    else patch({ customerId: c.id, pointsToUse: 0 });
    onClose();
  };

  useEffect(() => {
    if (!liveMode() || q.trim().length < 2) {
      setRemote(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void posApi
        .searchCustomers(q.trim())
        .then((rows) => setRemote(rows as Customer[]))
        .catch(() => setRemote([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [q]);

  if (adding)
    return (
      <Dialog
        title="New customer"
        sub="Creates one account they can also use on the website and app."
        onClose={onClose}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Back</Button>
            <Button
              variant="primary"
              disabled={!form.name.trim() || form.phone.replace(/\D/g, "").length < 10}
              onClick={async () => {
                try {
                  const c = liveMode()
                    ? await posApi.createCustomer({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined })
                    : db.addCustomer({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() });
                  if (liveMode()) useDb.setState({ customers: [c as Customer, ...db.customers] });
                  db.log(`New customer ${c.name} signed up in store`, "sale");
                  toast(`${c.name} added.`);
                  pick(c as Customer);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Could not create customer");
                }
              }}
            >
              Save customer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email (optional)" hint="For digital receipts and order updates.">
            <Input inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    );

  return (
    <Dialog
      title="Find a customer"
      sub="Same accounts as the website and app."
      onClose={onClose}
      footer={
        <Button icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
          New customer
        </Button>
      }
    >
      <SearchBox autoFocus value={q} onChange={setQ} placeholder="Name, phone or email" />
      <ul className="mt-3 divide-y divide-line">
        {matches.map((c) => (
          <li key={c.id}>
            <button onClick={() => pick(c)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-canvas">
              <Avatar name={c.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="tnum block text-xs text-muted">{c.phone}</span>
              </span>
              <span className="text-right">
                <TierBadge tier={c.tier} />
                <span className="tnum mt-0.5 block text-xs text-muted">{c.loyaltyPoints.toLocaleString()} pts</span>
              </span>
            </button>
          </li>
        ))}
        {!matches.length && <li className="py-8 text-center text-sm text-muted">No customer found. Add them as new.</li>}
      </ul>
    </Dialog>
  );
}

function CodeDialog({ onClose }: { onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const coupons = useDb((s) => s.coupons);
  const [code, setCode] = useState(cart.couponCode ?? "");
  const [error, setError] = useState("");
  const apply = (c: string) => {
    const found = coupons.find((x) => x.code === c.trim().toUpperCase());
    if (!found) return setError("That code doesn't exist.");
    if (!found.active) return setError("That code has ended.");
    if (!found.channels.includes("store")) return setError("That code is for online orders only.");
    patch({ couponCode: found.code });
    toast(`${found.code} applied`);
    onClose();
  };
  return (
    <Dialog
      title="Promo code"
      sub="Codes are set up in Promotions in the admin."
      size="sm"
      onClose={onClose}
      footer={
        <>
          {cart.couponCode && (
            <Button
              className="mr-auto"
              onClick={() => {
                patch({ couponCode: undefined });
                onClose();
              }}
            >
              Remove code
            </Button>
          )}
          <Button variant="primary" onClick={() => apply(code)} disabled={!code.trim()}>
            Apply
          </Button>
        </>
      }
    >
      <Input autoFocus aria-label="Promo code" className="font-mono uppercase" value={code} onChange={(e) => (setCode(e.target.value), setError(""))} onKeyDown={(e) => e.key === "Enter" && apply(code)} />
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
      <p className="mb-2 mt-4 text-xs font-medium text-muted">Running in store</p>
      <div className="flex flex-wrap gap-2">
        {coupons
          .filter((c) => c.active && c.channels.includes("store"))
          .map((c) => (
            <button key={c.code} onClick={() => apply(c.code)} className="rounded-lg border border-line px-3 py-2 text-left hover:bg-canvas">
              <span className="block font-mono text-[13px] font-medium">{c.code}</span>
              <span className="text-xs text-muted">{c.label}</span>
            </button>
          ))}
      </div>
    </Dialog>
  );
}

function PointsDialog({ customer, max, onClose }: { customer: Customer; max: number; onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const l = useDb((s) => s.settings.loyalty);
  const [pts, setPts] = useState(cart.pointsToUse || max);
  const ok = pts === 0 || (pts >= l.minRedeem && pts <= max);
  return (
    <Dialog
      title="Pay with points"
      sub={`${customer.name} has ${customer.loyaltyPoints.toLocaleString()} points. Each is worth ${naira(l.pointValue)}.`}
      size="sm"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          className="w-full"
          disabled={!ok}
          onClick={() => {
            patch({ pointsToUse: pts });
            onClose();
          }}
        >
          {pts ? `Use ${pts.toLocaleString()} points · ${naira(pts * l.pointValue)} off` : "Don't use points"}
        </Button>
      }
    >
      <input type="range" min={0} max={max} step={10} value={pts} onChange={(e) => setPts(Number(e.target.value))} className="w-full accent-[#c4561c]" aria-label="Points to use" />
      <div className="mt-2 flex gap-2">
        {[0, Math.floor(max / 2), max].map((v, i) => (
          <Button key={i} size="sm" onClick={() => setPts(v)} className="flex-1">
            {i === 0 ? "None" : i === 1 ? "Half" : "All"}
          </Button>
        ))}
      </div>
      {!ok && <p className="mt-3 text-[13px] text-bad">Use at least {l.minRedeem} points.</p>}
    </Dialog>
  );
}

function HeldDialog({ onClose }: { onClose: () => void }) {
  const held = useTill((s) => s.held);
  const cart = useTill((s) => s.cart);
  const staff = useDb((s) => s.staff);
  return (
    <Dialog title="Held sales" sub="Parked baskets on this till." onClose={onClose}>
      {!held.length ? (
        <Empty icon={<Pause size={20} />} title="Nothing parked" body="Park a sale while a customer keeps browsing or tries something on." />
      ) : (
        <ul className="divide-y divide-line">
          {held.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{h.label}</p>
                <p className="text-[13px] text-muted">
                  {h.cart.lines.reduce((a, l) => a + l.qty, 0)} items · {fmtTime(h.at)} · {staff.find((s) => s.id === h.staffId)?.name.split(" ")[0]}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => useTill.setState({ held: held.filter((x) => x.id !== h.id) })}>
                Delete
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const rest = held.filter((x) => x.id !== h.id);
                  useTill.setState(cart.lines.length ? { cart: h.cart, held: [{ id: uid(), at: new Date().toISOString(), label: "Swapped sale", cart, staffId: useTill.getState().staffId ?? "" }, ...rest] } : { cart: h.cart, held: rest });
                  onClose();
                }}
              >
                Resume
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function NoteDialog({ onClose }: { onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const [note, setNote] = useState(cart.note ?? "");
  return (
    <Dialog
      title="Note on this sale"
      size="sm"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            patch({ note: note || undefined });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <textarea autoFocus aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-ink" placeholder="Shows on the order in the admin" />
    </Dialog>
  );
}

/* ---------- Gift cards, alterations, delivery, sales credit, wishlist ---------- */

function Extra({ icon, title, sub, amount, onRemove }: { icon: React.ReactNode; title: string; sub: string; amount: number; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3" data-testid="cart-extra">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="tnum text-[13.5px] font-semibold">{amount ? naira(amount) : "Free"}</span>
      <button aria-label={`Remove ${title}`} onClick={onRemove} className="text-faint hover:text-bad">
        <X size={15} />
      </button>
    </li>
  );
}

function GiftCardSaleDialog({ onClose }: { onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const svc = useDb((s) => s.settings.services);
  const [amount, setAmount] = useState(svc.giftCardPresets[1] ?? 50000);
  const [custom, setCustom] = useState("");
  const value = custom ? Number(custom.replace(/\D/g, "")) || 0 : amount;
  return (
    <Dialog
      title="Sell a gift card"
      sub={`Works in store, on the website and in the app. Valid for ${svc.giftCardExpiryMonths} months.`}
      size="sm"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          className="w-full"
          disabled={value < 5000}
          data-testid="add-gift-card"
          onClick={() => {
            patch({ giftCards: [...(cart.giftCards ?? []), { key: uid(), amount: value }] });
            toast(`${naira(value)} gift card added to the sale`);
            onClose();
          }}
        >
          Add gift card · {naira(value)}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {svc.giftCardPresets.map((v) => (
          <button key={v} onClick={() => (setAmount(v), setCustom(""))} aria-pressed={!custom && amount === v} className={cx("tnum h-14 rounded-xl border text-base font-semibold", !custom && amount === v ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas")}>
            {naira(v)}
          </button>
        ))}
      </div>
      <Field label="Other amount" hint="From ₦5,000" className="mt-4">
        <Input aria-label="Gift card amount" prefix="₦" inputMode="numeric" className="tnum" value={custom ? Number(custom.replace(/\D/g, "")).toLocaleString("en-NG") : ""} onChange={(e) => setCustom(e.target.value)} />
      </Field>
      <p className="mt-4 text-[13px] text-muted">The code prints on the receipt and can be texted to the person receiving it. Gift cards don't earn points and can't be discounted.</p>
    </Dialog>
  );
}

export function GiftCardBalanceDialog({ onClose }: { onClose: () => void }) {
  const cards = useDb((s) => s.giftCards);
  const [code, setCode] = useState("");
  const [looked, setLooked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<GiftCard | null>(null);
  const local = cards.find((g) => g.code.replace(/\W/g, "") === code.toUpperCase().replace(/\W/g, ""));
  const card = liveMode() ? remote : local;

  const check = async () => {
    setLooked(true);
    if (!liveMode()) return;
    setBusy(true);
    setRemote(null);
    try {
      const g = await posApi.giftCard(code.trim());
      setRemote({
        code: g.code,
        initial: g.initial,
        balance: g.balance,
        issuedAt: g.issuedAt ?? new Date().toISOString(),
        expires: g.expiresAt ?? g.expires ?? new Date().toISOString(),
        status: g.status,
        history: (g.history ?? g.events ?? []).map((h: any) => ({
          at: typeof h.at === "string" ? h.at : new Date(h.at).toISOString(),
          amount: typeof h.amount === "number" && h.amount > 1000 ? fromKobo(h.amount) : h.amount,
          kind: h.kind,
          ref: h.ref ?? "",
        })),
      } as GiftCard);
    } catch {
      setRemote(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Gift card balance" sub="Scan the card or type its code." size="sm" onClose={onClose}>
      <div className="flex gap-2">
        <Input autoFocus aria-label="Gift card code" className="font-mono uppercase" placeholder="GC-0000-0000" value={code} onChange={(e) => (setCode(e.target.value), setLooked(false), setRemote(null))} onKeyDown={(e) => e.key === "Enter" && void check()} />
        <Button disabled={busy || !code.trim()} onClick={() => void check()}>
          {busy ? "…" : "Check"}
        </Button>
      </div>
      {!liveMode() && <p className="mt-2 text-xs text-faint">Sample codes: {cards.slice(0, 2).map((c) => c.code).join(" · ")}</p>}
      {looked && !busy && !card && <p className="mt-4 rounded-lg bg-bad-soft p-3 text-[13px] text-bad">No gift card with that code.</p>}
      {looked && card && (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="text-xs text-muted">Balance</p>
          <p className="tnum text-3xl font-semibold">{naira(card.balance)}</p>
          <p className="mt-1 text-[13px] text-muted">
            of {naira(card.initial)} · {card.status === "active" ? `expires ${fmtDate(card.expires)}` : card.status === "used" ? "fully used" : "cancelled"}
          </p>
          {!!card.history?.length && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
              {card.history.map((h, i) => (
                <li key={i} className="tnum flex justify-between">
                  <span className="text-muted">
                    {fmtDate(h.at)} · {h.kind} · {h.ref}
                  </span>
                  <span>{naira(h.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}

function DeliveryDialog({ goods, onClose }: { goods: number; onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const db = useDb();
  const customer = db.customers.find((c) => c.id === cart.customerId);
  const svc = db.settings.services;
  const [d, setD] = useState<DeliveryDraft>(cart.delivery ?? { name: customer?.name ?? "", phone: customer?.phone ?? "", address: "", city: "Lagos", zone: svc.zones[0]?.name ?? "", fee: 0 });
  const [liveFee, setLiveFee] = useState<number | null>(null);
  const [rates, setRates] = useState<{ id: string; name: string; price: number; days?: number }[]>([]);
  const zone = svc.zones.find((z) => z.name === d.zone);
  const free = svc.freeDeliveryOver > 0 && goods >= svc.freeDeliveryOver;
  const fee = free ? 0 : liveFee ?? zone?.fee ?? 0;
  const from = [...new Set(cart.lines.filter((l) => l.shipFrom).map((l) => db.stores.find((s) => s.id === l.shipFrom)?.name))].join(", ");

  useEffect(() => {
    if (!liveMode() || !d.address.trim() || !d.city.trim()) {
      setLiveFee(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      posApi
        .shippingQuote(
          { fullName: d.name || "Customer", phone: d.phone || "0000000000", address: d.address, city: d.city, state: d.city, country: "NG" },
          goods,
        )
        .then((raw: any) => {
          if (cancelled) return;
          const options = Array.isArray(raw) ? raw : raw?.options ?? raw?.rates ?? [];
          const mapped: { id: string; name: string; price: number; days?: number }[] = options.map((o: any) => ({
            id: String(o.id ?? o.rateId ?? o.name),
            name: String(o.name ?? o.label ?? o.carrier ?? "Delivery"),
            price: fromKobo(o.price ?? o.amount ?? o.fee ?? 0),
            days: o.days ?? o.etaDays,
          }));
          setRates(mapped);
          const match = mapped.find((r) => r.name === d.zone) ?? mapped[0];
          if (match) {
            setLiveFee(match.price);
            if (!svc.zones.some((z) => z.name === match.name)) setD((prev) => ({ ...prev, zone: match.name }));
          }
        })
        .catch(() => {
          if (!cancelled) setLiveFee(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [d.address, d.city, d.name, d.phone, goods]);

  return (
    <Dialog
      title="Ship to the customer"
      sub={`Sent from ${from}. The customer gets tracking by SMS.`}
      onClose={onClose}
      footer={
        <>
          {cart.delivery && (
            <Button className="mr-auto" onClick={() => (patch({ delivery: undefined }), onClose())}>
              Remove address
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!d.name.trim() || d.phone.replace(/\D/g, "").length < 10 || !d.address.trim()}
            data-testid="save-delivery"
            onClick={() => {
              patch({ delivery: { ...d, fee } });
              onClose();
            }}
          >
            Save · delivery {fee ? naira(fee) : "free"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipient">
          <Input aria-label="Recipient" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input aria-label="Recipient phone" inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input aria-label="Address" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} placeholder="House number, street, area" />
        </Field>
        <Field label="City">
          <Input aria-label="City" value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} />
        </Field>
        <Field label="Zone">
          <Select
            aria-label="Delivery zone"
            value={d.zone}
            onChange={(e) => {
              const name = e.target.value;
              const rate = rates.find((r: { name: string; price: number }) => r.name === name);
              setD({ ...d, zone: name });
              if (rate) setLiveFee(rate.price);
            }}
          >
            {(rates.length ? rates.map((r) => ({ name: r.name, fee: r.price, days: r.days ?? 2 })) : svc.zones).map((z) => (
              <option key={z.name} value={z.name}>
                {z.name} · {naira(z.fee)} · {z.days} {z.days === 1 ? "day" : "days"}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {free && <p className="mt-4 rounded-lg bg-gold-soft p-3 text-[13px] text-gold-ink">Free delivery: the sale is over {naira(svc.freeDeliveryOver)}.</p>}
    </Dialog>
  );
}

function AssociateDialog({ onClose }: { onClose: () => void }) {
  const cart = useTill((s) => s.cart);
  const patch = useTill((s) => s.patchCart);
  const staff = useDb((s) => s.staff);
  const me = useMe()!;
  const { store } = useRegister();
  const team = staff.filter((s) => s.active && s.storeIds.includes(store.id));
  const current = cart.associateId ?? me.id;
  return (
    <Dialog title="Who gets the sales credit?" sub="Counts towards their target and commission. Change it on one item from the item itself." size="sm" onClose={onClose}>
      <ul className="divide-y divide-line">
        {team.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => {
                patch({ associateId: s.id === me.id ? undefined : s.id });
                onClose();
              }}
              className={cx("flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left", s.id === current ? "bg-gold-soft" : "hover:bg-canvas")}
            >
              <Avatar name={s.name} size={34} />
              <span className="flex-1">
                <span className="block text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted">
                  {s.role}
                  {s.id === me.id && " · signed in"}
                </span>
              </span>
              {s.id === current && <UserCheck size={17} className="text-gold-ink" />}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function WishlistDialog({ customer, onOpen, onClose }: { customer: Customer; onOpen: (p: Product) => void; onClose: () => void }) {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const { store } = useRegister();
  const list = (customer.wishlist ?? []).map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return (
    <Dialog title={`${customer.name.split(" ")[0]}'s wishlist`} sub="Saved in the ASL app and on the website." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((p) => {
          const n = p.variants.reduce((a, v) => a + (inventory[v.id]?.[store.id] ?? 0), 0);
          return (
            <button key={p.id} onClick={() => onOpen(p)} className="overflow-hidden rounded-lg border border-line text-left hover:border-line-strong">
              <img src={p.image} alt="" className={cx("aspect-square w-full object-cover", n === 0 && "opacity-60 grayscale")} />
              <span className="block px-2.5 py-2">
                <span className="block truncate text-[12.5px] font-medium">{p.name}</span>
                <span className="tnum flex justify-between text-[11.5px]">
                  <span>{naira(p.price)}</span>
                  <span className={n ? "text-good" : "text-faint"}>{n ? `${n} here` : "Not here"}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
