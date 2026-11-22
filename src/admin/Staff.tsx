import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Plus } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { mapStoreRole, toApiRole, hasApiPerm, PERM_TO_API } from "../api/permissions";
import { adminPosApi } from "../api/pos";
import { uid, useDb } from "../data/store";
import type { Permission, Role, Staff } from "../data/types";
import { Avatar, Badge, Button, Dialog, Field, Input, Segmented, Select, Toggle, toast } from "../ui/kit";
import { PageHead, Td, Th } from "./Admin";

const PERMS: { id: Permission; label: string; sub: string }[] = [
  { id: "discount", label: "Give discounts", sub: "Up to the role's limit below" },
  { id: "priceOverride", label: "Change a price", sub: "Override the price of an item" },
  { id: "refund", label: "Refund with a receipt", sub: "Returns against a found order" },
  { id: "refundNoReceipt", label: "Refund without a receipt", sub: "Blind returns" },
  { id: "voidSale", label: "Clear a sale in progress", sub: "Empty a basket with items in it" },
  { id: "cashMoves", label: "Pay cash in or out", sub: "Bank deposits, petty cash" },
  { id: "openClose", label: "Open and close the register", sub: "Count the drawer" },
  { id: "stockAdjust", label: "Adjust stock", sub: "Counts, damages, receiving" },
  { id: "viewReports", label: "See sales reports", sub: "Session totals at the till" },
];
const ROLES: Role[] = ["Cashier", "Supervisor", "Manager"];

function mapApiStaff(r: any): Staff {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: mapStoreRole(r.role),
    pin: r.hasPin ? "****" : "",
    storeIds: r.locationIds ?? [],
    active: r.status === "active",
    permissions: r.permissions,
    discountLimitPct: r.discountLimitPct,
  };
}

export default function StaffPage() {
  const db = useDb();
  const live = liveMode();
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [edit, setEdit] = useState<Staff | null>(null);
  const roles = db.settings.roles;
  const limits = db.settings.discounts.limits;

  const refresh = useCallback(() => {
    if (!live) return;
    adminPosApi
      .staff()
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).map(mapApiStaff);
        useDb.setState({ staff: list });
        const nextLimits = { ...useDb.getState().settings.discounts.limits };
        for (const s of list) if (s.discountLimitPct != null) nextLimits[s.role] = s.discountLimitPct;
        useDb.getState().setSettings("discounts", { limits: nextLimits });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load staff"));
  }, [live]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <PageHead
        title="Staff & roles"
        sub="Who can use the tills, which stores they work in, and what each role may do. When someone lacks a permission, the till asks for a manager's PIN instead."
        actions={
          tab === "staff" && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ id: uid(), name: "", email: "", role: "Cashier", pin: "", storeIds: db.stores.filter((s) => s.sellsInPerson).map((s) => s.id).slice(0, 1), active: true })}>
              Add staff
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "staff", label: `Staff (${db.staff.length})` },
            { value: "roles", label: "Roles & permissions" },
          ]}
        />
      </div>

      {tab === "staff" ? (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-canvas/60">
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Stores</Th>
                  <Th>Till PIN</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {db.staff.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={p.name} size={32} />
                        <span>
                          <span className="block font-medium">{p.name}</span>
                          <span className="text-xs text-muted">{p.email}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={p.role === "Manager" ? "dark" : p.role === "Supervisor" ? "gold" : "neutral"}>{p.role}</Badge>
                    </Td>
                    <Td className="text-ink-2">{p.storeIds.map((id) => db.stores.find((s) => s.id === id)?.name.split(" ")[0]).join(", ")}</Td>
                    <Td className="text-muted">{p.pin ? "••••" : "Not set"}</Td>
                    <Td>{p.active ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                    <Td right>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>
                        Edit
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          {live && <p className="border-b border-line bg-canvas/40 px-4 py-3 text-[13px] text-muted">Live mode: permissions follow server roles (Cashier / Supervisor / Manager). Discount caps sync from the server.</p>}
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="permissions">
              <thead className="bg-canvas/60">
                <tr>
                  <Th>Permission</Th>
                  {ROLES.map((r) => (
                    <Th key={r} className="text-center">
                      {r}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERMS.map((perm) => (
                  <tr key={perm.id}>
                    <Td>
                      <span className="block font-medium">{perm.label}</span>
                      <span className="text-xs text-muted">{perm.sub}{live ? ` · ${PERM_TO_API[perm.id]}` : ""}</span>
                    </Td>
                    {ROLES.map((r) => {
                      const sample = db.staff.find((s) => s.role === r && s.permissions?.length);
                      const checked = live && sample?.permissions ? hasApiPerm(sample.permissions, perm.id) : roles[r][perm.id];
                      return (
                        <Td key={r} className="text-center">
                          <span className="inline-flex">
                            <Toggle
                              ariaLabel={`${r}: ${perm.label}`}
                              checked={checked}
                              disabled={live}
                              onChange={(v) => {
                                if (live) return;
                                db.setSettings("roles", { [r]: { ...roles[r], [perm.id]: v } });
                                db.log(`${r} permission "${perm.label}" turned ${v ? "on" : "off"}`, "settings");
                              }}
                            />
                          </span>
                        </Td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <Td>
                    <span className="block font-medium">Largest discount without approval</span>
                    <span className="text-xs text-muted">Per sale, as a percentage</span>
                  </Td>
                  {ROLES.map((r) => (
                    <Td key={r} className="text-center">
                      <Input
                        aria-label={`${r} discount limit`}
                        className="tnum mx-auto h-9 w-20 text-center"
                        value={limits[r]}
                        inputMode="numeric"
                        disabled={live}
                        onChange={(e) => db.setSettings("discounts", { limits: { ...limits, [r]: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) } })}
                      />
                    </Td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && <StaffDialog person={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
    </>
  );
}

function StaffDialog({ person, onClose, onSaved }: { person: Staff; onClose: () => void; onSaved: () => void }) {
  const db = useDb();
  const live = liveMode();
  const [p, setP] = useState(person);
  const [busy, setBusy] = useState(false);
  const exists = db.staff.some((s) => s.id === person.id);
  const pinTaken = !live && db.staff.some((s) => s.id !== p.id && s.pin === p.pin && p.pin.length === 4);
  const pinOk = live ? (exists ? p.pin.length === 0 || p.pin.length === 4 || p.pin === "****" : p.pin.length === 4) : p.pin.length === 4;

  return (
    <Dialog
      title={exists ? `Edit ${person.name}` : "Add staff"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !p.name.trim() || !pinOk || pinTaken || !p.storeIds.length || !p.email.trim()}
            onClick={async () => {
              if (live) {
                setBusy(true);
                try {
                  await adminPosApi.upsertStaff({
                    id: exists ? p.id : undefined,
                    name: p.name.trim(),
                    email: p.email.trim(),
                    role: toApiRole(p.role),
                    locationIds: p.storeIds,
                    pin: p.pin && p.pin !== "****" ? p.pin : undefined,
                    active: p.active,
                  });
                  toast("Staff saved. They can sign in on the till straight away.");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not save staff");
                } finally {
                  setBusy(false);
                }
                return;
              }
              db.upsertStaff(p);
              db.log(`${exists ? "Updated" : "Added"} staff member ${p.name}`, "settings");
              toast("Staff saved. They can sign in on the till straight away.");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Field>
        <Field label="Work email">
          <Input value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={p.role} onChange={(e) => setP({ ...p, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="4-digit till PIN" hint={pinTaken ? <span className="text-bad">Another person already uses this PIN.</span> : live && exists ? "Leave as •••• to keep the current PIN, or enter a new one." : "Staff type this to sign in to a till."}>
          <div className="flex gap-2">
            <Input value={p.pin === "****" ? "" : p.pin} placeholder={exists ? "••••" : undefined} inputMode="numeric" maxLength={4} onChange={(e) => setP({ ...p, pin: e.target.value.replace(/\D/g, "") })} className="tnum" />
            <Button type="button" onClick={() => setP({ ...p, pin: String(Math.floor(1000 + Math.random() * 8999)) })} icon={<KeyRound size={15} />}>
              New
            </Button>
          </div>
        </Field>
      </div>
      <p className="mb-2 mt-5 text-[13px] font-medium text-ink-2">Works at</p>
      <div className="flex flex-wrap gap-2">
        {db.stores
          .filter((s) => s.sellsInPerson)
          .map((s) => {
            const on = p.storeIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setP({ ...p, storeIds: on ? p.storeIds.filter((x) => x !== s.id) : [...p.storeIds, s.id] })}
                aria-pressed={on}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${on ? "border-ink bg-canvas font-medium" : "border-line"}`}
              >
                {on && <Check size={15} />}
                {s.name}
              </button>
            );
          })}
      </div>
      <Toggle label="Active" description="Inactive staff can't sign in to any till." checked={p.active} onChange={(v) => setP({ ...p, active: v })} />
    </Dialog>
  );
}
