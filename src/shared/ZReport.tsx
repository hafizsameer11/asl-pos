import { useDb } from "../data/store";
import type { Session } from "../data/types";
import { naira } from "../lib/pricing";
import { sessionReport } from "../lib/session";
import { Badge, Row, fmtDate, fmtTime } from "../ui/kit";
import { METHOD } from "./Receipt";

export function ZReport({ session }: { session: Session }) {
  const db = useDb();
  const r = sessionReport(session, db.orders);
  const reg = db.registers.find((x) => x.id === session.registerId);
  const store = db.stores.find((x) => x.id === session.storeId);
  const who = (id?: string) => db.staff.find((s) => s.id === id)?.name ?? "—";
  const variance = session.counted !== undefined ? session.counted - (session.expected ?? r.expectedCash) : undefined;
  const tol = db.settings.cash.tolerance;
  return (
    <div className="print-area tnum space-y-4 text-[13px]" data-testid="z-report">
      <div className="rounded-lg bg-canvas p-4">
        <p className="font-semibold">
          {store?.name} · {reg?.name}
        </p>
        <p className="text-muted">
          Opened {fmtDate(session.openedAt)} {fmtTime(session.openedAt)} by {who(session.openedBy)}
        </p>
        {session.closedAt && (
          <p className="text-muted">
            Closed {fmtTime(session.closedAt)} by {who(session.closedBy)}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sales</p>
        <Row label="Transactions" value={r.count} />
        <Row label="Units" value={r.units} />
        <Row label="Discounts given" value={naira(-r.discounts)} />
        <Row label="Sales after discounts" value={naira(r.sales)} strong />
        <Row label="Returns" value={naira(-r.refundTotal)} />
        <Row label="Net sales" value={naira(r.sales - r.refundTotal)} strong />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payments taken</p>
        {Object.entries(r.byMethod).map(([m, v]) => (
          <Row key={m} label={METHOD[m]} value={naira(v)} />
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cash drawer</p>
        <Row label="Opening float" value={naira(session.float)} />
        <Row label="Cash sales" value={naira(r.byMethod.cash)} />
        <Row label="Cash refunds" value={naira(-r.refunds.cash)} />
        <Row label="Paid in" value={naira(r.paidIn)} />
        <Row label="Paid out" value={naira(-r.paidOut)} />
        <Row label="Expected" value={naira(session.expected ?? r.expectedCash)} strong />
        {session.counted !== undefined && <Row label="Counted" value={naira(session.counted)} strong />}
        {variance !== undefined && (
          <div className="flex justify-between pt-1">
            <span>Variance</span>
            <Badge tone={variance === 0 ? "good" : Math.abs(variance) <= tol ? "warn" : "bad"}>{variance === 0 ? "Balanced" : `${naira(variance)} ${variance > 0 ? "over" : "short"}`}</Badge>
          </div>
        )}
      </div>
      {session.moves.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cash movements</p>
          {session.moves.map((m) => (
            <Row key={m.id} label={`${fmtTime(m.at)} · ${m.reason}`} value={naira(m.type === "in" ? m.amount : -m.amount)} />
          ))}
        </div>
      )}
    </div>
  );
}
