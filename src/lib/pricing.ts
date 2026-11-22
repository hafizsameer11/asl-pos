import type { Category, Channel, Coupon, Customer, Promotion, Settings } from "../data/types";

export type Disc = { type: "percent" | "amount"; value: number; reason?: string; max?: number };

export interface PricedInput {
  qty: number;
  unitPrice: number;
  discount?: Disc;
  /** Needed for automatic promotions. */
  category?: Category;
  brand?: string;
  /** Lines with a manual discount or price change don't also get promotions. */
  noPromo?: boolean;
}

/** Promotions running now for this channel and store. */
export function livePromos(promos: Promotion[], channel: Channel, storeId: string | undefined, now = new Date()) {
  const t = now.getTime();
  return promos.filter((p) => p.active && p.channels.includes(channel) && (!p.stores.length || (!!storeId && p.stores.includes(storeId))) && new Date(p.starts).getTime() <= t && new Date(p.ends).getTime() >= t);
}

const inScope = (p: Promotion, l: PricedInput) => p.scope.type === "all" || (p.scope.type === "category" ? l.category === p.scope.value : l.brand === p.scope.value);

export const isBirthdayMonth = (c: Customer | undefined, now = new Date()) => !!c?.birthday && Number(c.birthday.slice(0, 2)) === now.getMonth() + 1;

/**
 * Works out automatic promotions one after another, each on what's left of the line.
 * Returns the amount off each line and a summary per promotion.
 */
export function applyPromos(lines: PricedInput[], bases: number[], promos: Promotion[], customer?: Customer, now = new Date()) {
  const off = lines.map(() => 0);
  const applied: { id: string; label: string; amount: number }[] = [];
  for (const p of promos) {
    const idx = lines.map((_, i) => i).filter((i) => !lines[i].noPromo && inScope(p, lines[i]) && bases[i] - off[i] > 0);
    if (!idx.length) continue;
    const take = lines.map(() => 0);
    if (p.kind === "bxgy" && p.buy && p.get) {
      // For every full group of buy+get units, the cheapest `get` units are free.
      const units = idx.flatMap((i) => Array.from({ length: lines[i].qty }, () => ({ i, price: (bases[i] - off[i]) / lines[i].qty }))).sort((a, b) => b.price - a.price);
      const free = Math.floor(units.length / (p.buy + p.get)) * p.get;
      for (const u of free ? units.slice(-free) : []) take[u.i] += Math.round(u.price);
    } else if (p.kind === "percent" || (p.kind === "birthday" && isBirthdayMonth(customer, now))) {
      for (const i of idx) take[i] = Math.round(((bases[i] - off[i]) * p.value) / 100);
    } else if (p.kind === "spend") {
      const scoped = idx.reduce((a, i) => a + bases[i] - off[i], 0);
      if (scoped >= (p.minSpend ?? 0)) {
        const shares = allocate(Math.min(p.value, scoped), idx.map((i) => bases[i] - off[i]));
        idx.forEach((i, k) => (take[i] = shares[k]));
      }
    }
    const amount = take.reduce((a, b) => a + b, 0);
    if (amount <= 0) continue;
    take.forEach((t, i) => (off[i] += Math.min(t, bases[i] - off[i])));
    applied.push({ id: p.id, label: p.label, amount });
  }
  return { off, applied };
}

export function discountOf(base: number, d?: Disc) {
  if (!d || base <= 0) return 0;
  const raw = Math.min(d.type === "percent" ? (base * d.value) / 100 : d.value, d.max ?? Infinity);
  return Math.min(base, Math.max(0, Math.round(raw)));
}

/** Splits `total` across lines by weight so the shares add up exactly. */
export function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((a, b) => a + b, 0);
  for (const [, i] of exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])) {
    if (left-- <= 0) break;
    shares[i] += 1;
  }
  return shares;
}

export function couponProblem(coupon: Coupon | undefined, afterLines: number): string | null {
  if (!coupon) return "That code doesn't exist";
  if (!coupon.active) return "That code has ended";
  if (!coupon.channels.includes("store")) return "That code is for online orders only";
  if (afterLines < coupon.minSpend) return `Needs a spend of ₦${coupon.minSpend.toLocaleString("en-NG")} or more`;
  return null;
}

export interface Quote {
  /** lineDiscount includes `promo`. */
  lines: { gross: number; lineDiscount: number; promo: number; net: number }[];
  subtotal: number;
  /** Manual item discounts only. */
  lineDiscounts: number;
  promos: { id: string; label: string; amount: number }[];
  promoTotal: number;
  /** Gift cards sold, alterations and delivery: added after discounts. */
  extras: number;
  coupon: number;
  couponError: string | null;
  manual: number;
  points: number;
  pointsUsed: number;
  discountTotal: number;
  total: number;
  vat: number;
  credit: number;
  due: number;
  earn: number;
}

export function quote(args: {
  lines: PricedInput[];
  coupon?: Coupon;
  couponCode?: string;
  manual?: Disc;
  pointsToUse: number;
  customer?: Customer;
  settings: Settings;
  exchangeCredit?: number;
  promos?: Promotion[];
  extras?: { amount: number; kind: string }[];
  now?: Date;
}): Quote {
  const { settings } = args;
  const manualLine = args.lines.map((l) => discountOf(l.qty * l.unitPrice, l.discount));
  const promo = applyPromos(args.lines, args.lines.map((l, i) => l.qty * l.unitPrice - manualLine[i]), args.promos ?? [], args.customer, args.now);
  const priced = args.lines.map((l, i) => {
    const gross = l.qty * l.unitPrice;
    const lineDiscount = manualLine[i] + promo.off[i];
    return { gross, lineDiscount, promo: promo.off[i], after: gross - lineDiscount };
  });
  const afterLines = priced.reduce((a, l) => a + l.after, 0);
  const extras = (args.extras ?? []).reduce((a, x) => a + x.amount, 0);
  // Gift cards are money, not goods: no VAT until they're spent.
  const vatFree = (args.extras ?? []).filter((x) => x.kind === "giftcard").reduce((a, x) => a + x.amount, 0);

  let coupon = 0;
  let couponError: string | null = null;
  if (args.couponCode) {
    couponError = couponProblem(args.coupon, afterLines);
    if (!couponError) coupon = discountOf(afterLines, args.coupon && { type: args.coupon.type === "fixed" ? "amount" : "percent", value: args.coupon.value, max: args.coupon.maxDiscount });
  }
  const manual = discountOf(afterLines - coupon, args.manual);
  const beforePoints = afterLines - coupon - manual;
  const maxPoints = args.customer ? Math.min(args.customer.loyaltyPoints, Math.floor(beforePoints / settings.loyalty.pointValue)) : 0;
  const pointsUsed = Math.max(0, Math.min(args.pointsToUse, maxPoints));
  const points = pointsUsed * settings.loyalty.pointValue;
  const goods = beforePoints - points;
  const total = goods + extras;
  const shares = allocate(coupon + manual + points, priced.map((l) => l.after));
  const credit = args.exchangeCredit ?? 0;
  const multiplier = args.customer ? settings.loyalty.multipliers[args.customer.tier] : 0;
  return {
    lines: priced.map((l, i) => ({ gross: l.gross, lineDiscount: l.lineDiscount, promo: l.promo, net: l.after - shares[i] })),
    subtotal: priced.reduce((a, l) => a + l.gross, 0),
    lineDiscounts: priced.reduce((a, l) => a + l.lineDiscount - l.promo, 0),
    promos: promo.applied,
    promoTotal: promo.applied.reduce((a, p) => a + p.amount, 0),
    extras,
    coupon,
    couponError,
    manual,
    points,
    pointsUsed,
    discountTotal: priced.reduce((a, l) => a + l.lineDiscount, 0) + coupon + manual + points,
    total,
    vat: vatOf(total - vatFree, settings.general.vatRate),
    credit,
    due: total - credit,
    // Points are earned on goods only, not on gift cards or fees.
    earn: args.customer && settings.loyalty.earnAtPos ? Math.floor((Math.max(0, goods) / settings.loyalty.earnPer) * multiplier) : 0,
  };
}

export function vatOf(total: number, rate: number) {
  return Math.round((total * rate) / (100 + rate));
}

/** Refund for `qty` more units of a line. The last unit takes whatever is left, so a full return equals what was paid. */
export function refundFor(net: number, bought: number, alreadyQty: number, alreadyAmount: number, qty: number) {
  if (qty <= 0 || alreadyQty + qty > bought) return 0;
  if (alreadyQty + qty === bought) return net - alreadyAmount;
  return Math.round((net * qty) / bought);
}

export const naira = (n: number) => `${n < 0 ? "-" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;

export function percentOff(base: number, d?: Disc) {
  return base > 0 ? (discountOf(base, d) / base) * 100 : 0;
}
