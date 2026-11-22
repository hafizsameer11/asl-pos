import type { Order, Session } from "../data/types";

export interface SessionReport {
  sales: number;
  count: number;
  units: number;
  discounts: number;
  byMethod: Record<string, number>;
  refunds: Record<string, number>;
  refundTotal: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
}

/** Everything the end-of-day (Z) report needs for one register session. */
export function sessionReport(session: Session, orders: Order[]): SessionReport {
  const end = session.closedAt ? new Date(session.closedAt).getTime() : Infinity;
  const start = new Date(session.openedAt).getTime();
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };
  const mine = orders.filter((o) => o.registerId === session.registerId && inWindow(o.createdAt));
  const byMethod: Record<string, number> = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const o of mine) for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  const refunds: Record<string, number> = { cash: 0, card: 0, transfer: 0, credit: 0 };
  let refundTotal = 0;
  for (const o of orders)
    for (const r of o.returns)
      if (r.registerId === session.registerId && inWindow(r.createdAt)) {
        refundTotal += r.amount;
        for (const p of r.refunds) refunds[p.method] = (refunds[p.method] ?? 0) + p.amount;
      }
  const paidIn = session.moves.filter((m) => m.type === "in").reduce((a, m) => a + m.amount, 0);
  const paidOut = session.moves.filter((m) => m.type === "out").reduce((a, m) => a + m.amount, 0);
  return {
    sales: mine.reduce((a, o) => a + o.total, 0),
    count: mine.length,
    units: mine.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.qty, 0), 0),
    discounts: mine.reduce((a, o) => a + o.discountTotal, 0),
    byMethod,
    refunds,
    refundTotal,
    paidIn,
    paidOut,
    expectedCash: session.float + byMethod.cash + paidIn - paidOut - refunds.cash,
  };
}
