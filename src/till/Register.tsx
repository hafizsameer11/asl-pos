import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Lock, Printer } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { posApi } from "../api/pos";
import { uid, useDb, useTill } from "../data/store";
import { naira } from "../lib/pricing";
import { sessionReport } from "../lib/session";
import { Badge, Button, Card, Dialog, Field, Input, Row, Select, Stat, fmtTime, toast } from "../ui/kit";
import { METHOD } from "../shared/Receipt";
import { ZReport } from "../shared/ZReport";
import { approvePerm, auditHere, can, useMe, useRegister } from "./common";

export default function RegisterScreen() {
  const me = useMe()!;
  const { reg, store } = useRegister();
  const sessionId = useTill((s) => s.sessionId);
  const session = useDb((s) => s.sessions.find((x) => x.id === sessionId))!;
  const orders = useDb((s) => s.orders);
  const staff = useDb((s) => s.staff);
  const [move, setMove] = useState<"in" | "out" | null>(null);
  const [closing, setClosing] = useState(false);
  const r = sessionReport(session, orders);
  const showTotals = can(me, "viewReports");

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
            <p className="mt-1 text-sm text-muted">
              {store.name} · {reg.name} · opened {fmtTime(session.openedAt)} by {staff.find((s) => s.id === session.openedBy)?.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<ArrowDownToLine size={16} />} onClick={() => setMove("in")}>
              Pay in
            </Button>
            <Button icon={<ArrowUpFromLine size={16} />} onClick={() => setMove("out")}>
              Pay out
            </Button>
            <Button variant="primary" icon={<Lock size={16} />} onClick={() => setClosing(true)} data-testid="close-register">
              Close register
            </Button>
          </div>
        </div>
        {showTotals ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Sales this session" value={naira(r.sales)} sub={`${r.count} transactions`} />
              <Stat label="Average sale" value={naira(r.count ? r.sales / r.count : 0)} sub={`${r.units} units`} />
              <Stat label="Returns" value={naira(r.refundTotal)} />
              <Stat label="Expected in drawer" value={naira(r.expectedCash)} sub={`Float ${naira(session.float)}`} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Payments taken">
                <div className="space-y-2 text-sm">
                  {Object.entries(r.byMethod).map(([m, v]) => (
                    <Row key={m} label={METHOD[m]} value={naira(v)} />
                  ))}
                </div>
              </Card>
              <Card title="Cash movements">
                {session.moves.length ? (
                  <div className="space-y-2 text-sm">
                    {session.moves.map((m) => (
                      <Row key={m.id} label={`${fmtTime(m.at)} · ${m.reason}`} value={naira(m.type === "in" ? m.amount : -m.amount)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No cash paid in or out yet.</p>
                )}
              </Card>
            </div>
          </>
        ) : (
          <p className="mt-6 rounded-xl border border-line bg-white p-6 text-sm text-muted">Your role can't see session totals. A supervisor or manager can, or turn on "See sales reports" for cashiers in the admin.</p>
        )}
      </div>
      {move && <MoveDialog type={move} onClose={() => setMove(null)} />}
      {closing && <CloseDialog onClose={() => setClosing(false)} />}
    </div>
  );
}

function MoveDialog({ type, onClose }: { type: "in" | "out"; onClose: () => void }) {
  const db = useDb();
  const reasons = type === "in" ? db.settings.cash.inReasons : db.settings.cash.outReasons;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(reasons[0]);
  const n = Number(amount.replace(/\D/g, "")) || 0;
  return (
    <Dialog
      title={type === "in" ? "Pay cash in" : "Pay cash out"}
      size="sm"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!n}
          onClick={async () => {
            const who = await approvePerm("cashMoves", "Approve cash movement", "Paying cash in or out needs a supervisor or manager.");
            if (!who) return;
            const sid = useTill.getState().sessionId!;
            const s = db.sessions.find((x) => x.id === sid)!;
            try {
              if (liveMode()) await posApi.cashMove(sid, type, n, reason);
              db.patchSession(sid, { moves: [...s.moves, { id: uid(), at: new Date().toISOString(), type, amount: n, reason, staffId: who.id }] });
              auditHere("cash", `Paid ${type === "in" ? "in" : "out"} ${naira(n)} (${reason})`, { amount: n, approvedBy: who.id });
              toast(`${naira(n)} paid ${type}`);
              onClose();
            } catch (e) {
              toast(e instanceof ApiError ? e.message : "Cash move failed");
            }
          }}
        >
          Record {naira(n)}
        </Button>
      }
    >
      <Field label="Amount">
        <Input autoFocus prefix="₦" inputMode="numeric" className="tnum" value={amount ? n.toLocaleString("en-NG") : ""} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Reason" className="mt-4">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

function CloseDialog({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const me = useMe()!;
  const sid = useTill((s) => s.sessionId)!;
  const session = db.sessions.find((s) => s.id === sid)!;
  const cash = db.settings.cash;
  const local = sessionReport(session, db.orders);
  const [apiExpected, setApiExpected] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!liveMode()) return;
    void posApi
      .zReport(sid)
      .then((z: any) => setApiExpected(fromKobo(z.expectedCash ?? z.expected ?? z.session?.expected ?? 0)))
      .catch(() => setApiExpected(null));
  }, [sid]);
  const expectedCash = apiExpected ?? local.expectedCash;
  const r = { ...local, expectedCash };
  const counted = cash.denominations.reduce((a, d) => a + d * (Number(counts[d]) || 0), 0);
  const variance = counted - r.expectedCash;
  const outside = Math.abs(variance) > cash.tolerance;

  if (closed) {
    const s = useDb.getState().sessions.find((x) => x.id === sid)!;
    return (
      <Dialog
        title="Register closed"
        sub="Z report saved to the admin under Registers & sessions."
        onClose={() => {
          useTill.setState({ sessionId: null, staffId: null });
        }}
        footer={
          <>
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>
              Print Z report
            </Button>
            <Button variant="primary" onClick={() => useTill.setState({ sessionId: null, staffId: null })}>
              Done
            </Button>
          </>
        }
      >
        <ZReport session={s} />
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Close the register"
      sub={cash.blindClose ? "Count the drawer. The expected amount is hidden until you finish." : "Count each note and coin in the drawer."}
      size="lg"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!counted || (outside && !note.trim())}
          onClick={async () => {
            const who = await approvePerm("openClose", "Close the register", "Closing needs someone allowed to open and close.");
            if (!who) return;
            try {
              if (liveMode()) await posApi.closeSession(sid, counted, note || undefined);
              db.patchSession(sid, { closedAt: new Date().toISOString(), closedBy: who.id, counted, expected: r.expectedCash, note: note || undefined });
              db.log(`${db.registers.find((x) => x.id === session.registerId)?.name} closed by ${me.name}. ${variance === 0 ? "Drawer balanced." : `${naira(Math.abs(variance))} ${variance > 0 ? "over" : "short"}.`}`, "register");
              setClosed(true);
            } catch (e) {
              toast(e instanceof ApiError ? e.message : "Could not close register");
            }
          }}
          data-testid="confirm-close"
        >
          Close and print Z report
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="grid grid-cols-2 gap-2">
          {cash.denominations.map((d) => (
            <label key={d} className="flex items-center gap-3 rounded-lg border border-line px-3">
              <span className="tnum w-16 text-sm font-medium">{naira(d)}</span>
              <span className="text-faint">×</span>
              <input aria-label={`${d} naira count`} inputMode="numeric" placeholder="0" className="tnum h-11 min-w-0 flex-1 bg-transparent text-right outline-none" value={counts[d] ?? ""} onChange={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, "") })} />
            </label>
          ))}
        </div>
        <div className="tnum space-y-2 rounded-xl bg-canvas p-4 text-sm">
          <Row label="Counted" value={naira(counted)} strong />
          {!cash.blindClose || counted ? (
            <>
              <Row label="Expected" value={naira(r.expectedCash)} muted />
              {counted > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span>Difference</span>
                  <Badge tone={variance === 0 ? "good" : outside ? "bad" : "warn"}>{variance === 0 ? "Balanced" : `${naira(variance)} ${variance > 0 ? "over" : "short"}`}</Badge>
                </div>
              )}
            </>
          ) : null}
          <p className="pt-2 text-xs text-muted">Card {naira(r.byMethod.card)} · Transfer {naira(r.byMethod.transfer)}</p>
        </div>
      </div>
      {outside && counted > 0 && (
        <Field label={`Explain the difference (over the ${naira(cash.tolerance)} allowed)`} className="mt-4">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Change given wrongly on one sale" />
        </Field>
      )}
    </Dialog>
  );
}
