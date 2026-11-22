import { useEffect, useState } from "react";
import { MonitorSmartphone, Plus, Printer } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { uid, useDb } from "../data/store";
import type { Register, Session } from "../data/types";
import { naira } from "../lib/pricing";
import { sessionReport } from "../lib/session";
import { Badge, Button, Dialog, Field, Input, Segmented, Select, Sheet, Toggle, fmtDay, fmtTime, timeAgo, toast } from "../ui/kit";
import { ZReport } from "../shared/ZReport";
import { PageHead, Td, Th } from "./Admin";

type LiveRegister = {
  id: string;
  name: string;
  locationId: string;
  locationName: string | null;
  device: string | null;
  printer: string | null;
  terminalId: string | null;
  drawer: boolean;
  online: boolean;
  lastSeenAt: string | null;
  openSession: { id: string; openedAt: string; openedById: string; float: number } | null;
};

type LiveSession = {
  id: string;
  registerId: string;
  openedById: string;
  openedAt: string;
  closedAt: string | null;
  float: number;
  counted: number | null;
  expected: number | null;
  register: { name: string; locationId: string; locationName?: string | null };
};

export default function Registers() {
  const db = useDb();
  const live = liveMode();
  const [tab, setTab] = useState<"registers" | "sessions">("registers");
  const [edit, setEdit] = useState<Register | null>(null);
  const [z, setZ] = useState<Session | null>(null);
  const [store, setStore] = useState("all");
  const [liveRegs, setLiveRegs] = useState<LiveRegister[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    Promise.all([adminPosApi.registers(), adminPosApi.sessions()])
      .then(([regs, sess]) => {
        setLiveRegs(regs as LiveRegister[]);
        setLiveSessions((sess as LiveSession[]).map((s) => ({ ...s, float: fromKobo(s.float), counted: s.counted != null ? fromKobo(s.counted) : null, expected: s.expected != null ? fromKobo(s.expected) : null })));
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load registers"));
  }, [live, tick]);

  const sessions = live
    ? liveSessions.filter((s) => store === "all" || s.register.locationId === store)
    : db.sessions.filter((s) => store === "all" || s.storeId === store);
  const registerList = live ? liveRegs : db.registers;

  return (
    <>
      <PageHead
        title="Registers & sessions"
        sub="Each register is a till device in a store. A session runs from opening the cash drawer to closing it, and ends with a Z report."
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              const storeId = db.stores.find((s) => s.sellsInPerson)?.id ?? db.stores[0]?.id ?? "";
              const warehouseId = db.stores.find((s) => s.id === storeId)?.warehouseId;
              setEdit({ id: live ? "" : uid(), name: "New till", storeId, warehouseId, device: "", printer: "Epson TM-m30III", terminalId: "", drawer: true, scanner: "Camera", online: false, lastSeen: new Date().toISOString() });
            }}
          >
            Add register
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "registers", label: `Registers (${registerList.length})` },
            { value: "sessions", label: "Session history" },
          ]}
        />
        {tab === "sessions" && (
          <Select value={store} onChange={(e) => setStore(e.target.value)} className="w-auto" aria-label="Store">
            <option value="all">All stores</option>
            {db.stores
              .filter((s) => s.sellsInPerson)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        )}
      </div>

      {tab === "registers" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {live
            ? liveRegs.map((r) => (
                <div key={r.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas">
                      <MonitorSmartphone size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {r.locationName ?? r.locationId} · {r.name}
                      </p>
                      <p className="text-[13px] text-muted">{r.device || "No device paired yet"}</p>
                    </div>
                    <Badge tone={r.online ? "good" : "neutral"} dot>
                      {r.online ? "Online" : `Offline · ${r.lastSeenAt ? timeAgo(r.lastSeenAt) : "—"}`}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                    <dt className="text-muted">Session</dt>
                    <dd>{r.openSession ? `Open since ${fmtTime(r.openSession.openedAt)}` : "Closed"}</dd>
                    <dt className="text-muted">Printer</dt>
                    <dd>{r.printer || "—"}</dd>
                    <dt className="text-muted">Card terminal</dt>
                    <dd>{r.terminalId || "None"}</dd>
                    <dt className="text-muted">Cash drawer</dt>
                    <dd>{r.drawer ? "Connected" : "None"}</dd>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setEdit({
                          id: r.id,
                          name: r.name,
                          storeId: r.locationId,
                          warehouseId: db.stores.find((s) => s.id === r.locationId)?.warehouseId,
                          device: r.device ?? "",
                          printer: r.printer ?? "Epson TM-m30III",
                          terminalId: r.terminalId ?? "",
                          drawer: r.drawer,
                          scanner: "Camera",
                          online: r.online,
                          lastSeen: r.lastSeenAt ?? new Date().toISOString(),
                        })
                      }
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))
            : db.registers.map((r) => {
                const st = db.stores.find((x) => x.id === r.storeId);
                const open = db.sessions.find((s) => s.registerId === r.id && !s.closedAt);
                return (
                  <div key={r.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas">
                        <MonitorSmartphone size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {st?.name} · {r.name}
                        </p>
                        <p className="text-[13px] text-muted">{r.device || "No device paired yet"}</p>
                      </div>
                      <Badge tone={r.online ? "good" : "neutral"} dot>
                        {r.online ? "Online" : `Offline · ${timeAgo(r.lastSeen)}`}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                      <dt className="text-muted">Session</dt>
                      <dd>{open ? `Open since ${fmtTime(open.openedAt)}` : "Closed"}</dd>
                      <dt className="text-muted">Printer</dt>
                      <dd>{r.printer}</dd>
                      <dt className="text-muted">Card terminal</dt>
                      <dd>{r.terminalId || "None"}</dd>
                      <dt className="text-muted">Cash drawer</dt>
                      <dd>{r.drawer ? "Connected" : "None"}</dd>
                    </dl>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => setEdit(r)}>
                        Edit
                      </Button>
                      {open && (
                        <Button size="sm" variant="ghost" onClick={() => setZ(open)}>
                          View open session
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <div className="thin-scroll overflow-x-auto">
            <table className="tnum w-full min-w-[760px] text-sm">
              <thead className="bg-canvas/60">
                <tr>
                  <Th>Day</Th>
                  <Th>Register</Th>
                  <Th>Opened by</Th>
                  <Th>Hours</Th>
                  <Th right>Sales</Th>
                  <Th right>Expected cash</Th>
                  <Th right>Counted</Th>
                  <Th right>Variance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {live
                  ? (sessions as LiveSession[]).map((s) => {
                      const v = s.counted != null && s.expected != null ? s.counted - s.expected : undefined;
                      return (
                        <tr key={s.id} className="hover:bg-canvas/70">
                          <Td className="font-medium">{fmtDay(s.openedAt)}</Td>
                          <Td>
                            {s.register.locationName ?? s.register.locationId} · {s.register.name}
                          </Td>
                          <Td>{db.staff.find((p) => p.id === s.openedById)?.name ?? s.openedById}</Td>
                          <Td className="text-muted">
                            {fmtTime(s.openedAt)}–{s.closedAt ? fmtTime(s.closedAt) : "open"}
                          </Td>
                          <Td right className="text-muted">
                            —
                          </Td>
                          <Td right>{s.expected != null ? naira(s.expected) : "—"}</Td>
                          <Td right>{s.counted != null ? naira(s.counted) : "—"}</Td>
                          <Td right>
                            {s.closedAt == null ? (
                              <Badge tone="info">Open</Badge>
                            ) : v === undefined ? (
                              <span className="text-faint">—</span>
                            ) : (
                              <Badge tone={v === 0 ? "good" : Math.abs(v) <= db.settings.cash.tolerance ? "warn" : "bad"}>{v === 0 ? "Balanced" : naira(v)}</Badge>
                            )}
                          </Td>
                        </tr>
                      );
                    })
                  : (sessions as Session[]).map((s) => {
                      const r = sessionReport(s, db.orders);
                      const v = s.counted !== undefined ? s.counted - (s.expected ?? r.expectedCash) : undefined;
                      const reg = db.registers.find((x) => x.id === s.registerId);
                      return (
                        <tr key={s.id} className="cursor-pointer hover:bg-canvas/70" onClick={() => setZ(s)}>
                          <Td className="font-medium">{fmtDay(s.openedAt)}</Td>
                          <Td>
                            {db.stores.find((x) => x.id === s.storeId)?.name} · {reg?.name}
                          </Td>
                          <Td>{db.staff.find((p) => p.id === s.openedBy)?.name}</Td>
                          <Td className="text-muted">
                            {fmtTime(s.openedAt)}–{s.closedAt ? fmtTime(s.closedAt) : "open"}
                          </Td>
                          <Td right>{naira(r.sales)}</Td>
                          <Td right>{naira(s.expected ?? r.expectedCash)}</Td>
                          <Td right>{s.counted !== undefined ? naira(s.counted) : "—"}</Td>
                          <Td right>
                            {v === undefined ? <Badge tone="info">Open</Badge> : <Badge tone={v === 0 ? "good" : Math.abs(v) <= db.settings.cash.tolerance ? "warn" : "bad"}>{v === 0 ? "Balanced" : naira(v)}</Badge>}
                          </Td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && <RegisterDialog reg={edit} onClose={() => setEdit(null)} onSaved={() => setTick((n) => n + 1)} />}
      {z && (
        <Sheet
          title="Z report"
          sub={fmtDay(z.openedAt)}
          onClose={() => setZ(null)}
          footer={
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>
              Print
            </Button>
          }
        >
          <div className="p-6">
            <ZReport session={z} />
          </div>
        </Sheet>
      )}
    </>
  );
}

function RegisterDialog({ reg, onClose, onSaved }: { reg: Register; onClose: () => void; onSaved: () => void }) {
  const db = useDb();
  const live = liveMode();
  const [r, setR] = useState(reg);
  const [busy, setBusy] = useState(false);
  const isNew = live ? !reg.id : !db.registers.some((x) => x.id === reg.id);
  const store = db.stores.find((s) => s.id === r.storeId);
  const warehouseId = r.warehouseId ?? store?.warehouseId;
  return (
    <Dialog
      title={isNew ? "Add register" : `Edit ${reg.name}`}
      sub="Pair a tablet by opening the till on it and entering the pairing code shown after saving."
      onClose={onClose}
      footer={
        <>
          {!live && !isNew && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                db.removeRegister(reg.id);
                toast("Register removed");
                onClose();
              }}
            >
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || (live && !warehouseId)}
            onClick={async () => {
              if (live) {
                if (!warehouseId) return toast("This store needs a stock warehouse before you can save a register");
                setBusy(true);
                try {
                  await adminPosApi.upsertRegister({
                    id: isNew ? undefined : r.id,
                    locationId: r.storeId,
                    warehouseId,
                    name: r.name,
                    device: r.device || undefined,
                    printer: r.printer || undefined,
                    terminalId: r.terminalId || undefined,
                    drawer: r.drawer,
                    scanner: r.scanner || undefined,
                    active: true,
                  });
                  toast(isNew ? "Register added" : "Register saved");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not save register");
                } finally {
                  setBusy(false);
                }
                return;
              }
              db.upsertRegister(r);
              db.log(`${isNew ? "Added" : "Updated"} register ${r.name}`, "register");
              toast(isNew ? `Register added · pairing code ${Math.floor(100000 + Math.random() * 899999)}` : "Register saved");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </Field>
        <Field label="Store">
          <Select value={r.storeId} onChange={(e) => setR({ ...r, storeId: e.target.value })}>
            {db.stores
              .filter((s) => s.sellsInPerson)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Device label" className="sm:col-span-2">
          <Input value={r.device} placeholder="e.g. iPad · Front desk" onChange={(e) => setR({ ...r, device: e.target.value })} />
        </Field>
        <Field label="Receipt printer">
          <Select value={r.printer} onChange={(e) => setR({ ...r, printer: e.target.value })}>
            {["Epson TM-m30III", "Star mC-Print3", "Star TSP143IV", "None (email/SMS only)"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="Card terminal ID">
          <Input value={r.terminalId} onChange={(e) => setR({ ...r, terminalId: e.target.value })} placeholder="TID" />
        </Field>
      </div>
      <Toggle label="Cash drawer connected" checked={r.drawer} onChange={(v) => setR({ ...r, drawer: v })} description="Opens when a cash sale completes or a manager opens it." />
    </Dialog>
  );
}
