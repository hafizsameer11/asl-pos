import { useEffect, useState, type ReactNode } from "react";
import { ApiError, clearTokens, getAccessToken, liveMode } from "../api/client";
import { posApi, toStaff } from "../api/pos";
import { useDb } from "../data/store";
import type { Staff } from "../data/types";
import { Avatar, Badge, Button, cx, toast } from "../ui/kit";
import { PinPad } from "../till/common";

const ADMIN_STAFF_KEY = "asl-pos-admin-staff";

export function readAdminStaff(): Staff | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_STAFF_KEY);
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

function writeAdminStaff(s: Staff | null) {
  if (!s) sessionStorage.removeItem(ADMIN_STAFF_KEY);
  else sessionStorage.setItem(ADMIN_STAFF_KEY, JSON.stringify(s));
}

/** POS admin used to open with no login (prototype). Gate it behind a till PIN. */
export default function AdminGate({ children }: { children: (staff: Staff, signOut: () => void) => ReactNode }) {
  const live = liveMode();
  const seedStaff = useDb((s) => s.staff);
  const [staff, setStaff] = useState<Staff | null>(() => readAdminStaff());
  const [checking, setChecking] = useState(live && !!getAccessToken());
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live || !getAccessToken()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    posApi
      .me()
      .then((me) => {
        if (cancelled) return;
        const row = toStaff(me);
        setStaff(row);
        writeAdminStaff(row);
        useDb.setState({ staff: [row, ...useDb.getState().staff.filter((s) => s.id !== row.id)] });
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        writeAdminStaff(null);
        setStaff(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const signOut = () => {
    posApi.logout();
    writeAdminStaff(null);
    setStaff(null);
    setPin("");
    toast("Signed out of POS admin");
  };

  const finishPin = async (next: string) => {
    setBusy(true);
    setError("");
    try {
      if (live) {
        const out = await posApi.pinLogin(next);
        const row = toStaff(out.staff);
        setStaff(row);
        writeAdminStaff(row);
        useDb.setState({ staff: [row, ...useDb.getState().staff.filter((s) => s.id !== row.id)] });
        toast(`Welcome, ${row.name.split(" ")[0]}`);
      } else {
        const person = seedStaff.find((p) => p.pin === next && p.active);
        if (!person) {
          setError("That PIN isn't right.");
          setPin("");
          return;
        }
        if (person.role === "Cashier") {
          setError("Cashiers can't open POS admin. Use a supervisor or manager PIN.");
          setPin("");
          return;
        }
        setStaff(person);
        writeAdminStaff(person);
        toast(`Welcome, ${person.name.split(" ")[0]}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That PIN isn't right.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError("");
    if (next.length === 4) void finishPin(next);
  };

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-sm text-muted">
        Checking sign-in…
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex min-h-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-8 shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-[12px] font-bold tracking-wider text-white">ASL</span>
            <div>
              <p className="font-semibold">POS admin</p>
              <p className="text-[13px] text-muted">Sign in with a supervisor or manager till PIN.</p>
            </div>
          </div>
          <Badge tone={live ? "good" : "neutral"}>{live ? "Live API" : "Demo"}</Badge>
          <PinPad value={pin} onDigit={press} onBack={() => setPin((p) => p.slice(0, -1))} error={error} />
          <p className="mt-4 text-center text-xs text-faint">
            {busy ? "Signing in…" : live ? "Uses the same PIN as the till." : "Sample: Temi 1234 · Chidi 2468"}
          </p>
          <a href="#till" className="mt-6 block text-center text-[13px] font-medium text-muted hover:text-ink">
            Back to the till
          </a>
        </div>
      </div>
    );
  }

  return <>{children(staff, signOut)}</>;
}

export function AdminUserChip({ staff, onSignOut }: { staff: Staff; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-2 rounded-md border border-line px-2 py-1 text-[12px] sm:flex" title={staff.email}>
        <span className={cx("flex h-6 w-6 items-center justify-center rounded bg-gold/15 text-[10px] font-bold text-gold")}>
          {staff.role === "Manager" ? "SM" : staff.role === "Supervisor" ? "SV" : "CA"}
        </span>
        {staff.role}
      </span>
      <Avatar name={staff.name} size={32} />
      <Button size="sm" variant="ghost" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
