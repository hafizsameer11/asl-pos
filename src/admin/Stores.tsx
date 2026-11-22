import { useCallback, useEffect, useState } from "react";
import { Building2, Clock, MapPin, Phone, Warehouse } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { adminPosApi } from "../api/pos";
import { useDb } from "../data/store";
import type { Store } from "../data/types";
import { Badge, Button, Dialog, Field, Input, Toggle, toast } from "../ui/kit";
import { PageHead } from "./Admin";

export default function Stores() {
  const db = useDb();
  const live = liveMode();
  const [edit, setEdit] = useState<Store | null>(null);

  const refresh = useCallback(() => {
    if (!live) return;
    Promise.all([adminPosApi.locations(), adminPosApi.warehouses()])
      .then(([locs, whs]) => {
        const warehouses = Array.isArray(whs) ? whs : [];
        const stores: Store[] = (Array.isArray(locs) ? locs : []).map((l: any) => {
          const wh = warehouses.find((w: any) => w.pickupLocationId === l.id);
          return {
            id: l.id,
            name: l.name,
            address: [l.address, l.city].filter(Boolean).join(", "),
            phone: l.phone ?? "",
            hours: l.hours ?? "",
            kind: "store" as const,
            sellsInPerson: !!l.active,
            warehouseId: wh?.id,
          };
        });
        for (const w of warehouses) {
          if (!stores.some((s) => s.id === w.id)) {
            stores.push({
              id: w.id,
              name: w.name,
              address: w.city ?? "",
              phone: "",
              hours: "",
              kind: "warehouse",
              sellsInPerson: false,
              warehouseId: w.id,
            });
          }
        }
        // Keep register-derived boutiques if locations empty
        if (stores.length) useDb.setState({ stores });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load stores"));
  }, [live]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <PageHead title="Stores" sub="Physical locations that sell in person, and the stock locations behind them. Each store keeps its own stock count, and online orders can be picked up from any store that allows it." />
      <div className="grid gap-3 md:grid-cols-2">
        {db.stores.map((s) => {
          const regs = db.registers.filter((r) => r.storeId === s.id);
          const staff = db.staff.filter((p) => p.storeIds.includes(s.id) && p.active);
          const key = s.warehouseId ?? s.id;
          const units = Object.values(db.inventory).reduce((a, v) => a + (v[key] ?? v[s.id] ?? 0), 0);
          return (
            <div key={s.id} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas">{s.kind === "warehouse" ? <Warehouse size={19} /> : <Building2 size={19} />}</span>
                <div className="flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-[13px] text-muted">{s.kind === "warehouse" ? "Stock location · ships online orders" : `${regs.length} ${regs.length === 1 ? "register" : "registers"} · ${staff.length} staff`}</p>
                </div>
                {s.sellsInPerson ? <Badge tone="good">Sells in person</Badge> : <Badge>Stock only</Badge>}
              </div>
              <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
                <li className="flex gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
                  {s.address || "—"}
                </li>
                <li className="flex gap-2">
                  <Phone size={15} className="mt-0.5 shrink-0 text-faint" />
                  {s.phone || "—"}
                </li>
                <li className="flex gap-2">
                  <Clock size={15} className="mt-0.5 shrink-0 text-faint" />
                  {s.hours || "—"}
                </li>
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="tnum text-[13px] text-muted">{units.toLocaleString()} units in stock</span>
                {s.kind === "store" && (
                  <Button size="sm" onClick={() => setEdit(s)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {edit && <StoreDialog store={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
    </>
  );
}

function StoreDialog({ store, onClose, onSaved }: { store: Store; onClose: () => void; onSaved: () => void }) {
  const db = useDb();
  const live = liveMode();
  const [s, setS] = useState(store);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={`Edit ${store.name}`}
      sub="The name, address and phone print at the top of this store's receipts."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              if (live) {
                setBusy(true);
                try {
                  await adminPosApi.patchLocation(s.id, {
                    name: s.name,
                    address: s.address,
                    phone: s.phone,
                    hours: s.hours,
                    active: s.sellsInPerson,
                  });
                  toast("Store saved");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not save store");
                } finally {
                  setBusy(false);
                }
                return;
              }
              db.upsertStore(s);
              db.log(`Updated store ${s.name}`, "settings");
              toast("Store saved");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Store name">
          <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </Field>
        <Field label="Address">
          <Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} />
          </Field>
          <Field label="Opening hours">
            <Input value={s.hours} onChange={(e) => setS({ ...s, hours: e.target.value })} />
          </Field>
        </div>
      </div>
      <Toggle label="Sells in person" description="Turn off for a warehouse or a store that is closed for refit." checked={s.sellsInPerson} onChange={(v) => setS({ ...s, sellsInPerson: v })} />
    </Dialog>
  );
}
