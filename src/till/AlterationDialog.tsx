import { useState } from "react";
import { Scissors } from "lucide-react";
import { uid, useDb, type AlterationDraft } from "../data/store";
import { naira } from "../lib/pricing";
import { Button, Dialog, Field, Input, Select, cx } from "../ui/kit";

/**
 * Books an alteration. The fee goes on the sale as a charge; the ticket is created when the sale completes.
 * `items` are the garments in the sale; customers can also bring their own.
 */
export function AlterationDialog({ items, saleTotal, onSave, onClose }: { items: string[]; saleTotal: number; onSave: (d: AlterationDraft) => void; onClose: () => void }) {
  const svc = useDb((s) => s.settings.services);
  const [item, setItem] = useState(items[0] ?? "");
  const [own, setOwn] = useState(!items.length);
  const [work, setWork] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [tailor, setTailor] = useState(svc.tailors[0] ?? "");
  const [days, setDays] = useState(svc.turnaroundDays);
  const free = !own && svc.freeAlterationsOver > 0 && saleTotal >= svc.freeAlterationsOver;
  const price = work.reduce((a, w) => a + (svc.alterationMenu.find((m) => m.name === w)?.price ?? 0), 0);
  const fee = free ? 0 : price;
  const ready = new Date(Date.now() + days * 86400e3);

  return (
    <Dialog
      title="Book an alteration"
      sub="Prints a ticket for the garment and texts the customer when it's ready."
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          icon={<Scissors size={16} />}
          disabled={!work.length || !item.trim()}
          onClick={() => {
            onSave({ key: uid(), item: item.trim(), work, notes: notes.trim(), fee, tailor, readyBy: ready.toISOString() });
            onClose();
          }}
          data-testid="save-alteration"
        >
          Add to sale · {fee ? naira(fee) : "free"}
        </Button>
      }
    >
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={own ? "secondary" : "primary"} disabled={!items.length} onClick={() => (setOwn(false), setItem(items[0] ?? ""))}>
          Item in this sale
        </Button>
        <Button size="sm" variant={own ? "primary" : "secondary"} onClick={() => (setOwn(true), setItem(""))}>
          Customer's own garment
        </Button>
      </div>
      <Field label="Garment">
        {own ? (
          <Input aria-label="Garment" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Black agbada, bought elsewhere" />
        ) : (
          <Select aria-label="Garment" value={item} onChange={(e) => setItem(e.target.value)}>
            {items.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        )}
      </Field>
      <p className="mb-2 mt-4 text-[13px] font-medium text-ink-2">Work needed</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {svc.alterationMenu.map((m) => {
          const on = work.includes(m.name);
          return (
            <button key={m.name} aria-pressed={on} onClick={() => setWork(on ? work.filter((w) => w !== m.name) : [...work, m.name])} className={cx("flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px]", on ? "border-ink bg-ink text-white" : "border-line hover:bg-canvas")}>
              <span>{m.name}</span>
              <span className={cx("tnum", on ? "text-white/70" : "text-muted")}>{naira(m.price)}</span>
            </button>
          );
        })}
      </div>
      <Field label="Measurements and notes" className="mt-4">
        <Input aria-label="Measurements and notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Take up 3cm, wearing 100mm heels" />
      </Field>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Tailor">
          <Select aria-label="Tailor" value={tailor} onChange={(e) => setTailor(e.target.value)}>
            {svc.tailors.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label={`Ready by · ${ready.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}`}>
          <Select aria-label="Days to ready" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 7, 10, 14].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "day" : "days"}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {free && price > 0 && <p className="mt-4 rounded-lg bg-gold-soft p-3 text-[13px] text-gold-ink">Free: sales over {naira(svc.freeAlterationsOver)} include alterations. Normally {naira(price)}.</p>}
    </Dialog>
  );
}
