import { ReactNode, useEffect, useState } from "react";
import { Boxes, Cloud, CloudOff, LayoutGrid, Lock, LogOut, MonitorCog, PackageCheck, ReceiptText, RefreshCw, Scissors, Users, Wallet, Wifi, WifiOff } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { hydrateFromApi } from "../api/hydrate";
import { posApi, toStaff } from "../api/pos";
import { fromKobo } from "../api/money";
import { uid, useDb, useTill } from "../data/store";
import { naira } from "../lib/pricing";
import { Avatar, Badge, Button, Input, Toaster, cx, toast } from "../ui/kit";
import { writeAdminStaff } from "../admin/AdminGate";
import { ApprovalHost, can, PinPad, useMe, useRegister } from "./common";
import Sell from "./Sell";
import Orders from "./Orders";
import Pickups from "./Pickups";
import Customers from "./Customers";
import Stock from "./Stock";
import RegisterScreen from "./Register";
import Services from "./Services";

/** Seed demo register ids (r1–r4) must never be sent to the live PIN API. */
function isSeedRegisterId(id: string | null | undefined) {
  return !!id && /^r\d+$/i.test(id);
}

export type TillScreen = "sell" | "orders" | "pickups" | "services" | "customers" | "stock" | "register";
export const useScreen = () => {
  const [screen, setScreenState] = useState<TillScreen>((sessionStorage.getItem("till-screen") as TillScreen) || "sell");
  return [screen, (s: TillScreen) => (sessionStorage.setItem("till-screen", s), setScreenState(s))] as const;
};

/** Lets any screen jump to another, e.g. Customers → Sell with that customer. */
let goTo: (s: TillScreen) => void = () => {};
export const navigate = (s: TillScreen) => goTo(s);

export default function Till() {
  const staffId = useTill((s) => s.staffId);
  const sessionId = useTill((s) => s.sessionId);
  // A just-closed session stays selected until staff finish with its Z report.
  const session = useDb((s) => s.sessions.find((x) => x.id === sessionId));
  useSync();
  useEffect(() => {
    document.title = "ASL ORIGINALS POS";
  }, []);
  useEffect(() => {
    if (!liveMode()) return;
    const id = useTill.getState().registerId;
    if (!isSeedRegisterId(id)) return;
    const saved = localStorage.getItem("asl-pos-register");
    if (saved && !isSeedRegisterId(saved)) {
      useTill.getState().set({ registerId: saved });
      return;
    }
    localStorage.removeItem("asl-pos-register");
  }, []);

  let body: ReactNode;
  if (!staffId) body = <LockScreen />;
  else if (!session) body = <OpenRegister />;
  else body = <Shell />;
  return (
    <>
      {body}
      <ApprovalHost />
      <Toaster />
    </>
  );
}

/* ---------- Sync: offline queue and reconnect ---------- */

function useSync() {
  const offline = useTill((s) => s.offline);
  const registerId = useTill((s) => s.registerId);
  useEffect(() => {
    const db = useDb.getState();
    const reg = db.registers.find((r) => r.id === registerId);
    if (reg) db.upsertRegister({ ...reg, online: !offline, lastSeen: new Date().toISOString() });
    if (offline) return;
    const pending = db.orders.filter((o) => o.registerId === registerId && !o.synced);
    if (!pending.length) return;

    if (liveMode()) {
      const payloads = pending
        .map((o) => (o as { syncPayload?: unknown }).syncPayload)
        .filter(Boolean);
      if (!payloads.length) {
        pending.forEach((o) => useDb.getState().patchOrder(o.id, { synced: true }));
        return;
      }
      void posApi
        .syncSales(payloads)
        .then(() => {
          pending.forEach((o) => useDb.getState().patchOrder(o.id, { synced: true }));
          useDb.getState().log(`${reg?.name} synced ${pending.length} offline sales`, "sync");
          useTill.setState({ lastSync: new Date().toISOString() });
          toast(`Back online · ${pending.length} sales synced`);
        })
        .catch((e) => toast(e instanceof Error ? e.message : "Sync failed"));
      return;
    }

    let i = 0;
    const t = window.setInterval(() => {
      const o = pending[i++];
      if (!o) {
        window.clearInterval(t);
        useDb.getState().log(`${reg?.name} reconnected and synced ${pending.length} ${pending.length === 1 ? "sale" : "sales"}`, "sync");
        useTill.setState({ lastSync: new Date().toISOString() });
        toast(`Back online · ${pending.length} ${pending.length === 1 ? "sale" : "sales"} sent to the admin`);
        return;
      }
      useDb.getState().patchOrder(o.id, { synced: true });
    }, 450);
    return () => window.clearInterval(t);
  }, [offline, registerId]);

  useEffect(() => {
    const on = () => useTill.setState({ offline: false });
    const off = () => useTill.setState({ offline: true });
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
}

/* ---------- Lock screen ---------- */

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <p className="tnum text-[64px] font-semibold leading-none tracking-tight">{now.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</p>
      <p className="mt-2 text-muted">{now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</p>
    </>
  );
}

function LockScreen() {
  const staff = useDb((s) => s.staff);
  const sessions = useDb((s) => s.sessions);
  const registers = useDb((s) => s.registers);
  const { reg, store } = useRegister();
  const set = useTill((s) => s.set);
  const registerId = useTill((s) => s.registerId);
  const live = liveMode();
  const team = staff.filter((p) => p.active && p.storeIds.includes(store.id));
  const [who, setWho] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const open = sessions.find((s) => s.registerId === reg.id && !s.closedAt);

  const finishPin = async (next: string) => {
    if (live) {
      setBusy(true);
      try {
        // Never send seed demo ids (r1…) — omit and bind a live register after hydrate.
        const liveRegId = isSeedRegisterId(registerId) ? undefined : registerId;
        const out = await posApi.pinLogin(next, liveRegId);
        const staffRow = toStaff(out.staff);
        useDb.setState({ staff: [staffRow, ...useDb.getState().staff.filter((s) => s.id !== staffRow.id)] });
        if (staffRow.role !== "Cashier") writeAdminStaff(staffRow);
        const boot = await hydrateFromApi(liveRegId ?? out.registerId ?? undefined);
        const sid = boot?.openSessionId ?? null;
        const boundReg = boot?.registerId ?? out.registerId ?? liveRegId ?? registerId;
        if (boundReg && !isSeedRegisterId(boundReg)) {
          localStorage.setItem("asl-pos-register", boundReg);
        }
        set({ staffId: staffRow.id, sessionId: sid, registerId: boundReg });
        toast(`Welcome, ${staffRow.name.split(" ")[0]}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "That PIN isn't right.");
        setPin("");
      } finally {
        setBusy(false);
      }
      return;
    }
    const person = staff.find((p) => p.pin === next && p.active && (!who || p.id === who));
    if (person && person.storeIds.includes(store.id)) {
      set({ staffId: person.id, sessionId: open?.id ?? null });
      toast(`Welcome, ${person.name.split(" ")[0]}`);
    } else {
      setError(person ? "You're not set up for this store." : "That PIN isn't right.");
      setPin("");
    }
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError("");
    if (next.length < 4) return;
    void finishPin(next);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="flex min-h-full flex-col bg-canvas lg:flex-row">
      <div className="flex flex-col justify-between border-b border-line bg-white p-8 lg:w-[44%] lg:border-b-0 lg:border-r lg:p-12">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-[12px] font-bold tracking-wider text-white">ASL</span>
          <div>
            <p className="font-semibold">ASL ORIGINALS</p>
            <p className="text-[13px] text-muted">
              {store.name} · {reg.name}
            </p>
          </div>
        </div>
        <div className="py-10 lg:py-0">
          <Clock />
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone={open ? "good" : "neutral"} dot>
              {open ? "Register open" : "Register closed"}
            </Badge>
            <Badge tone="neutral">{reg.device || (live ? "Live API" : "Demo")}</Badge>
          </div>
          {live && (() => {
            const liveRegs = registers.filter((r) => !isSeedRegisterId(r.id));
            if (liveRegs.length <= 1) return null;
            const selectValue = liveRegs.some((r) => r.id === registerId) ? registerId : liveRegs[0]!.id;
            return (
              <label className="mt-6 block text-[13px] text-muted">
                Till
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-ink"
                  value={selectValue}
                  onChange={(e) => {
                    localStorage.setItem("asl-pos-register", e.target.value);
                    set({ registerId: e.target.value });
                  }}
                >
                  {liveRegs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })()}
        </div>
        <a href="#pos-overview" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted hover:text-ink">
          <MonitorCog size={16} />
          Open the POS admin
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px]">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">{live ? "Enter your 4-digit till PIN." : "Tap your name, then enter your PIN."}</p>
          {!live && (
            <div className="mt-6 grid grid-cols-3 gap-2">
              {team.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setWho(p.id);
                    setPin("");
                    setError("");
                  }}
                  aria-pressed={who === p.id}
                  className={cx("flex flex-col items-center gap-2 rounded-xl border bg-white p-3 transition-colors", who === p.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong")}
                >
                  <Avatar name={p.name} size={40} />
                  <span className="text-center text-[13px] font-medium leading-tight">{p.name.split(" ")[0]}</span>
                  <span className="text-[11px] text-muted">{p.role}</span>
                </button>
              ))}
            </div>
          )}
          <PinPad value={pin} onDigit={press} onBack={() => setPin((p) => p.slice(0, -1))} error={error} />
          <p className="mt-4 text-center text-xs text-faint">
            {busy ? "Signing in…" : live ? "Connected to ASL backend" : "Sample PINs: Temi 1234 · Chidi 2468 · Halima 1111"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Opening the register ---------- */

function OpenRegister() {
  const me = useMe()!;
  const { reg, store } = useRegister();
  const cash = useDb((s) => s.settings.cash);
  const last = useDb((s) => s.sessions.find((x) => x.registerId === reg.id && x.closedAt));
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [manual, setManual] = useState(String(cash.defaultFloat));
  const [byNotes, setByNotes] = useState(false);
  const counted = byNotes ? cash.denominations.reduce((a, d) => a + d * (Number(counts[d]) || 0), 0) : Number(manual.replace(/\D/g, "")) || 0;
  const allowed = can(me, "openClose");

  const open = async () => {
    if (liveMode()) {
      try {
        const session = await posApi.openSession(reg.id, counted);
        const id = session.id;
        useDb.getState().addSession({
          id,
          registerId: reg.id,
          storeId: store.id,
          openedBy: me.id,
          openedAt: typeof session.openedAt === "string" ? session.openedAt : new Date(session.openedAt).toISOString(),
          float: fromKobo(session.float),
          moves: [],
        });
        useDb.getState().log(`${store.name} ${reg.name} opened by ${me.name} with ${naira(counted)} float`, "register");
        useTill.setState({ sessionId: id });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Could not open register");
      }
      return;
    }
    const id = uid();
    useDb.getState().addSession({ id, registerId: reg.id, storeId: store.id, openedBy: me.id, openedAt: new Date().toISOString(), float: counted, moves: [] });
    useDb.getState().log(`${store.name} ${reg.name} opened by ${me.name} with ${naira(counted)} float`, "register");
    useTill.setState({ sessionId: id });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 shadow-card">
        <p className="text-[13px] text-muted">
          {store.name} · {reg.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Open the register</h1>
        <p className="mt-1 text-sm text-muted">Count the cash in the drawer before the first sale. {last && `Last closed with ${naira(last.counted ?? 0)} counted.`}</p>
        <div className="mt-6 flex gap-2">
          <Button size="sm" variant={byNotes ? "secondary" : "primary"} onClick={() => setByNotes(false)}>
            Enter total
          </Button>
          <Button size="sm" variant={byNotes ? "primary" : "secondary"} onClick={() => setByNotes(true)}>
            Count notes
          </Button>
        </div>
        {byNotes ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {cash.denominations.map((d) => (
              <label key={d} className="flex items-center gap-3 rounded-lg border border-line px-3">
                <span className="tnum w-16 text-sm font-medium">{naira(d)}</span>
                <span className="text-faint">×</span>
                <input aria-label={`${d} naira notes`} inputMode="numeric" className="tnum h-11 min-w-0 flex-1 bg-transparent text-right outline-none" placeholder="0" value={counts[d] ?? ""} onChange={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, "") })} />
              </label>
            ))}
          </div>
        ) : (
          <Input aria-label="Opening float" inputMode="numeric" className="tnum mt-4 h-14 text-xl" value={naira(Number(manual.replace(/\D/g, "") || 0))} onChange={(e) => setManual(e.target.value)} />
        )}
        <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">Opening float</span>
          <span className="tnum text-2xl font-semibold">{naira(counted)}</span>
        </div>
        {!allowed && <p className="mt-3 rounded-lg bg-warn-soft p-3 text-[13px] text-warn">Your role can't open the register. Ask a supervisor to sign in.</p>}
        <div className="mt-5 flex gap-2">
          <Button onClick={() => useTill.setState({ staffId: null })} icon={<Lock size={16} />}>
            Lock
          </Button>
          <Button variant="primary" size="lg" className="flex-1" disabled={!allowed} onClick={open}>
            Open register
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main shell ---------- */

function Shell() {
  const [screen, setScreen] = useScreen();
  goTo = setScreen;
  const me = useMe()!;
  const { reg, store } = useRegister();
  const pickups = useDb((s) => s.orders.filter((o) => o.fulfilment === "pickup" && o.pickupStoreId === store.id && (o.status === "processing" || o.status === "ready")).length);
  const offline = useTill((s) => s.offline);
  const pending = useDb((s) => s.orders.filter((o) => o.registerId === reg.id && !o.synced).length);
  // Alterations ready to hand back at this store.
  const ready = useDb((s) => s.alterations.filter((a) => a.storeId === store.id && a.status === "ready").length);
  const [menu, setMenu] = useState(false);
  usePickupAlerts(store.id);

  const NAV: { id: TillScreen; label: string; icon: typeof LayoutGrid; badge?: number }[] = [
    { id: "sell", label: "Sell", icon: LayoutGrid },
    { id: "orders", label: "Orders", icon: ReceiptText },
    { id: "pickups", label: "Pickups", icon: PackageCheck, badge: pickups },
    { id: "services", label: "Services", icon: Scissors, badge: ready },
    { id: "customers", label: "Customers", icon: Users },
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "register", label: "Register", icon: Wallet },
  ];

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav aria-label="Till" className="order-last flex shrink-0 bg-side text-white md:order-first md:w-[88px] md:flex-col md:py-4">
        <div className="mb-6 hidden flex-col items-center gap-1.5 md:flex">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[12px] font-bold tracking-[0.12em] text-ink">ASL</span>
          <span className="h-0.5 w-5 rounded-full bg-gold" />
        </div>
        <div className="flex flex-1 md:flex-col md:gap-1.5 md:px-2.5">
          {NAV.map(({ id, label, icon: Icon, badge }) => {
            const on = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                aria-current={on ? "page" : undefined}
                className={cx("relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium transition-colors md:flex-none", on ? "bg-white/[0.09] text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white")}
              >
                {on && <span className="absolute left-[-10px] top-1/2 hidden h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gold md:block" />}
                <Icon size={21} strokeWidth={on ? 2.1 : 1.7} className={on ? "text-gold" : ""} />
                {label}
                {!!badge && <span className="tnum absolute right-2 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white md:right-2.5">{badge}</span>}
              </button>
            );
          })}
        </div>
        <div className="hidden flex-col items-center gap-2 border-t border-side-line px-2.5 pt-4 md:flex">
          <button onClick={() => useTill.setState({ staffId: null })} title="Lock and switch staff" className="flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-white/55 hover:bg-white/[0.05] hover:text-white">
            <Lock size={19} strokeWidth={1.7} />
            Lock
          </button>
        </div>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-white px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {store.name} <span className="font-normal text-muted">· {reg.name}</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              data-testid="sync-pill"
              onClick={() => toast(offline ? `Offline. ${pending} ${pending === 1 ? "sale" : "sales"} saved on this till and will send when you reconnect.` : "Online. Prices, stock and orders are up to date.", offline ? "info" : "good")}
              className={cx("inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium", offline ? "bg-warn-soft text-warn" : "bg-good-soft text-good")}
            >
              {offline ? <CloudOff size={15} /> : pending ? <RefreshCw size={15} className="animate-spin" /> : <Cloud size={15} />}
              {offline ? `Offline${pending ? ` · ${pending} to sync` : ""}` : pending ? "Syncing" : "Synced"}
            </button>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-canvas" aria-haspopup="menu" aria-expanded={menu}>
                <Avatar name={me.name} size={32} />
                <span className="hidden text-left text-[13px] leading-tight sm:block">
                  <span className="block font-medium">{me.name.split(" ")[0]}</span>
                  <span className="text-muted">{me.role}</span>
                </span>
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                  <div role="menu" className="anim-rise absolute right-0 top-12 z-40 w-64 rounded-xl border border-line bg-white p-1.5 shadow-pop">
                    <MenuItem
                      icon={<Lock size={16} />}
                      onClick={() => {
                        useTill.setState({ staffId: null });
                        setMenu(false);
                      }}
                    >
                      Lock and switch staff
                    </MenuItem>
                    <MenuItem
                      icon={offline ? <Wifi size={16} /> : <WifiOff size={16} />}
                      onClick={() => {
                        useTill.setState({ offline: !offline });
                        setMenu(false);
                        toast(offline ? "Reconnecting…" : "Offline mode on. Sales are kept on this till.", "info");
                      }}
                    >
                      {offline ? "Go back online" : "Simulate going offline"}
                    </MenuItem>
                    <a href="#pos-overview" role="menuitem" className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-canvas">
                      <MonitorCog size={16} className="text-muted" />
                      Open the POS admin
                    </a>
                    <div className="my-1 border-t border-line" />
                    <MenuItem
                      icon={<LogOut size={16} />}
                      onClick={() => {
                        setScreen("register");
                        setMenu(false);
                      }}
                    >
                      End of day: close register
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          {screen === "sell" && <Sell />}
          {screen === "orders" && <Orders />}
          {screen === "pickups" && <Pickups />}
          {screen === "services" && <Services />}
          {screen === "customers" && <Customers />}
          {screen === "stock" && <Stock />}
          {screen === "register" && <RegisterScreen />}
        </main>
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-canvas">
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}

/** Tells staff when a new online order arrives for pickup at this store. */
function usePickupAlerts(storeId: string) {
  useEffect(() => {
    let known = new Set(useDb.getState().orders.filter((o) => o.fulfilment === "pickup").map((o) => o.id));
    return useDb.subscribe((s) => {
      const fresh = s.orders.filter((o) => o.fulfilment === "pickup" && o.pickupStoreId === storeId && !known.has(o.id));
      known = new Set(s.orders.filter((o) => o.fulfilment === "pickup").map((o) => o.id));
      for (const o of fresh) toast(`New ${o.channel === "web" ? "website" : "app"} order ${o.number} to pack for pickup`, "info", { label: "View", run: () => navigate("pickups") });
    });
  }, [storeId]);
}
