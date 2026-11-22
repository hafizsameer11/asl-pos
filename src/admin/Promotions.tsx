import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { toKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { mapPromo, type ApiPromo } from "../api/promoMap";
import { uid, useDb } from "../data/store";
import { CATEGORIES } from "../data/seed";
import type { Channel, Promotion } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Empty, Field, Input, Segmented, Select, Sheet, Toggle, cx, fmtDate, toast, type Tone } from "../ui/kit";
import { PageHead, Td, Th } from "./Admin";

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "pos", label: "In store" },
  { id: "web", label: "Website" },
  { id: "app", label: "App" },
];

export function promoStatus(p: Promotion): [string, Tone] {
  const now = Date.now();
  if (!p.active) return ["Paused", "neutral"];
  if (new Date(p.starts).getTime() > now) return ["Scheduled", "info"];
  if (new Date(p.ends).getTime() < now) return ["Ended", "neutral"];
  return ["Running", "good"];
}

export function promoSummary(p: Promotion) {
  if (p.kind === "bxgy") return `Buy ${p.buy}, get ${p.get} free (cheapest)`;
  if (p.kind === "percent") return `${p.value}% off`;
  if (p.kind === "spend") return `${naira(p.value)} off when spending ${naira(p.minSpend ?? 0)}`;
  return `${p.value}% off in the customer's birthday month`;
}

const scopeText = (p: Promotion) => (p.scope.type === "all" ? "Everything" : `${p.scope.type === "category" ? "Category" : "Brand"}: ${p.scope.value}`);

function promoToApiBody(p: Promotion) {
  return {
    name: p.name.trim(),
    label: p.label.trim(),
    kind: p.kind,
    buy: p.buy,
    get: p.get,
    value: p.kind === "spend" ? toKobo(p.value) : p.value,
    minSpend: p.minSpend != null ? toKobo(p.minSpend) : undefined,
    scope: p.scope,
    channels: p.channels.map((c) => (c === "pos" ? "pos" : c)),
    stores: p.stores,
    startsAt: p.starts,
    endsAt: p.ends,
    active: p.active,
  };
}

export default function Promotions() {
  const dbPromos = useDb((s) => s.promotions);
  const stores = useDb((s) => s.stores);
  const live = liveMode();
  const [remote, setRemote] = useState<Promotion[]>([]);
  const [edit, setEdit] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<"all" | "live">("all");

  const load = useCallback(() => {
    if (!live) return;
    adminPosApi
      .promotions()
      .then((rows) => setRemote((rows as ApiPromo[]).map(mapPromo)))
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load promotions"));
  }, [live]);

  useEffect(() => {
    load();
  }, [load]);

  const promos = live ? remote : dbPromos;
  const rows = useMemo(() => {
    const order = { Running: 0, Scheduled: 1, Paused: 2, Ended: 3 } as Record<string, number>;
    return promos.filter((p) => filter === "all" || promoStatus(p)[0] === "Running").sort((a, b) => order[promoStatus(a)[0]] - order[promoStatus(b)[0]]);
  }, [promos, filter]);
  const running = promos.filter((p) => promoStatus(p)[0] === "Running").length;

  const blank = (): Promotion => {
    const d = new Date();
    return { id: uid(), name: "", label: "", kind: "percent", value: 10, scope: { type: "all" }, channels: ["pos", "web", "app"], stores: [], starts: d.toISOString(), ends: new Date(d.getTime() + 14 * 86400e3).toISOString(), active: true };
  };

  return (
    <>
      <PageHead
        title="Automatic promotions"
        sub="Offers the tills apply on their own, with no code to type: multi-buys, brand or category sales, spend-and-save and birthday treats. The same rules can run on the website and app, so prices match everywhere."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit(blank())}>
            New promotion
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: `All (${promos.length})` }, { value: "live", label: `Running now (${running})` }]} />
        <p className="text-[13px] text-muted">Promotions don't stack with a manual item discount or a changed price on the same item. Promo codes still apply on top.</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <Th>Promotion</Th>
                <Th>Offer</Th>
                <Th>Applies to</Th>
                <Th>Where</Th>
                <Th>Dates</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => {
                const [st, tone] = promoStatus(p);
                return (
                  <tr key={p.id} onClick={() => setEdit(p)} className="cursor-pointer hover:bg-canvas/60" data-testid="promo-row">
                    <Td>
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-muted">Receipt: {p.label}</span>
                    </Td>
                    <Td>{promoSummary(p)}</Td>
                    <Td>{scopeText(p)}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {CHANNELS.filter((c) => p.channels.includes(c.id)).map((c) => (
                          <Badge key={c.id} tone={c.id === "pos" ? "dark" : "neutral"}>
                            {c.label}
                          </Badge>
                        ))}
                      </span>
                      {p.channels.includes("pos") && <span className="mt-1 block text-xs text-muted">{p.stores.length ? p.stores.map((id) => stores.find((s) => s.id === id)?.name).join(", ") : "All stores"}</span>}
                    </Td>
                    <Td className="tnum whitespace-nowrap text-muted">
                      {fmtDate(p.starts)} – {fmtDate(p.ends)}
                    </Td>
                    <Td>
                      <Badge tone={tone} dot>
                        {st}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<Sparkles size={20} />} title="Nothing running" body="Create a promotion and the tills pick it up within seconds." />
      )}
      {edit && <Editor promo={edit} isNew={!promos.some((p) => p.id === edit.id)} live={live} onClose={() => setEdit(null)} onSaved={load} />}
    </>
  );
}

const day = (iso: string) => iso.slice(0, 10);

function Editor({ promo, isNew, live, onClose, onSaved }: { promo: Promotion; isNew: boolean; live: boolean; onClose: () => void; onSaved: () => void }) {
  const products = useDb((s) => s.products);
  const stores = useDb((s) => s.stores);
  const upsert = useDb((s) => s.upsertPromotion);
  const remove = useDb((s) => s.removePromotion);
  const log = useDb((s) => s.log);
  const [p, setP] = useState<Promotion>(promo);
  const brands = useMemo(() => [...new Set(products.map((x) => x.brand))].sort(), [products]);
  const set = (patch: Partial<Promotion>) => setP({ ...p, ...patch });
  const valid = p.name.trim() && p.label.trim() && p.channels.length && (p.kind === "bxgy" ? (p.buy ?? 0) > 0 && (p.get ?? 0) > 0 : p.value > 0) && p.ends > p.starts;

  return (
    <Sheet
      title={isNew ? "New promotion" : p.name}
      sub={isNew ? "Applied automatically when the basket qualifies." : promoSummary(p)}
      onClose={onClose}
      width={560}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={async () => {
                if (live) {
                  try {
                    await adminPosApi.deletePromotion(p.id);
                    toast("Promotion deleted");
                    onSaved();
                    onClose();
                  } catch (e) {
                    toast(e instanceof ApiError ? e.message : "Could not delete promotion");
                  }
                  return;
                }
                remove(p.id);
                log(`Promotion "${p.name}" deleted`, "settings");
                toast("Promotion deleted");
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              const body = promoToApiBody({ ...p, name: p.name.trim(), label: p.label.trim() });
              if (live) {
                try {
                  if (isNew) await adminPosApi.createPromotion(body);
                  else await adminPosApi.updatePromotion(p.id, body);
                  toast(isNew ? "Promotion created. Tills update in seconds." : "Promotion saved");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : "Could not save promotion");
                }
                return;
              }
              upsert({ ...p, name: p.name.trim(), label: p.label.trim() });
              log(`Promotion "${p.name.trim()}" ${isNew ? "created" : "updated"}`, "settings");
              toast(isNew ? "Promotion created. Tills update in seconds." : "Promotion saved");
              onClose();
            }}
          >
            {isNew ? "Create promotion" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-5 p-6">
        <Field label="Name" hint="For staff and reports.">
          <Input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Accessories 3 for 2" />
        </Field>
        <Field label="Receipt label" hint="Short. Shown in the basket and printed on the receipt.">
          <Input value={p.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. 3 for 2" />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Offer</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["bxgy", "Buy X, get Y free"],
                ["percent", "Percentage off"],
                ["spend", "Spend and save"],
                ["birthday", "Birthday month"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} aria-pressed={p.kind === k} onClick={() => set({ kind: k, buy: k === "bxgy" ? p.buy ?? 2 : p.buy, get: k === "bxgy" ? p.get ?? 1 : p.get })} className={cx("h-11 rounded-lg border text-[13px] font-medium", p.kind === k ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas")}>
                {l}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {p.kind === "bxgy" && (
              <>
                <Field label="Buy">
                  <Input aria-label="Buy" inputMode="numeric" className="tnum" value={p.buy ?? ""} onChange={(e) => set({ buy: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </Field>
                <Field label="Get free">
                  <Input aria-label="Get free" inputMode="numeric" className="tnum" value={p.get ?? ""} onChange={(e) => set({ get: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </Field>
              </>
            )}
            {(p.kind === "percent" || p.kind === "birthday") && (
              <Field label="Percent off">
                <Input aria-label="Percent off" inputMode="numeric" className="tnum" value={p.value || ""} onChange={(e) => set({ value: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
              </Field>
            )}
            {p.kind === "spend" && (
              <>
                <Field label="Spend at least">
                  <Input aria-label="Spend at least" prefix="₦" inputMode="numeric" className="tnum" value={(p.minSpend ?? 0).toLocaleString("en-NG")} onChange={(e) => set({ minSpend: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </Field>
                <Field label="Save">
                  <Input aria-label="Save" prefix="₦" inputMode="numeric" className="tnum" value={p.value.toLocaleString("en-NG")} onChange={(e) => set({ value: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </Field>
              </>
            )}
          </div>
          {p.kind === "birthday" && <p className="mt-2 text-[13px] text-muted">Applies when the customer on the sale has a birthday this month. The till shows a birthday banner.</p>}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Applies to</p>
          <Segmented size="sm" value={p.scope.type} onChange={(t) => set({ scope: { type: t, value: t === "all" ? undefined : t === "category" ? CATEGORIES[0] : brands[0] } })} options={[{ value: "all", label: "Everything" }, { value: "category", label: "A category" }, { value: "brand", label: "A brand" }]} />
          {p.scope.type !== "all" && (
            <Select aria-label="Scope" className="mt-3" value={p.scope.value} onChange={(e) => set({ scope: { ...p.scope, value: e.target.value } })}>
              {(p.scope.type === "category" ? CATEGORIES : brands).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Where it runs</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = p.channels.includes(c.id);
              return (
                <button key={c.id} aria-pressed={on} onClick={() => set({ channels: on ? p.channels.filter((x) => x !== c.id) : [...p.channels, c.id] })} className={cx("h-9 rounded-full border px-3.5 text-[13px] font-medium", on ? "border-ink bg-ink text-white" : "border-line")}>
                  {c.label}
                </button>
              );
            })}
          </div>
          {p.channels.includes("pos") && (
            <>
              <p className="mb-2 mt-4 text-[13px] text-muted">Stores (none picked means every store)</p>
              <div className="flex flex-wrap gap-2">
                {stores
                  .filter((s) => s.sellsInPerson)
                  .map((s) => {
                    const on = p.stores.includes(s.id);
                    return (
                      <button key={s.id} aria-pressed={on} onClick={() => set({ stores: on ? p.stores.filter((x) => x !== s.id) : [...p.stores, s.id] })} className={cx("h-9 rounded-full border px-3.5 text-[13px]", on ? "border-gold bg-gold-soft font-medium text-gold-ink" : "border-line")}>
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="date" aria-label="Starts" value={day(p.starts)} onChange={(e) => e.target.value && set({ starts: new Date(`${e.target.value}T00:00:00`).toISOString() })} />
          </Field>
          <Field label="Ends">
            <Input type="date" aria-label="Ends" value={day(p.ends)} onChange={(e) => e.target.value && set({ ends: new Date(`${e.target.value}T23:59:59`).toISOString() })} />
          </Field>
        </div>
        {p.ends <= p.starts && <p className="text-[13px] text-bad">The end date must be after the start.</p>}
        <div className="rounded-xl border border-line px-4">
          <Toggle label="Active" description="Pause it without deleting it." checked={p.active} onChange={(v) => set({ active: v })} />
        </div>
      </div>
    </Sheet>
  );
}
