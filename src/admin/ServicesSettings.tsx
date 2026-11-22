import { Plus, Trash2 } from "lucide-react";
import { useDb } from "../data/store";
import type { Role } from "../data/types";
import { naira } from "../lib/pricing";
import { Button, Input, Segmented, Toggle, cx } from "../ui/kit";
import { PageHead, RowField, SavedNote, Section } from "./Admin";
import { ListEditor, Money, num, useGroup } from "./SettingsPages";

function Days({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input aria-label={label} className="tnum w-20" value={value} onChange={(e) => onChange(num(e.target.value))} />
      <span className="text-sm text-muted">days</span>
    </div>
  );
}

function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} onClick={onClick} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-canvas hover:text-bad">
      <Trash2 size={16} />
    </button>
  );
}

/* ---------------- Services: layaway, alterations, delivery, gift cards ---------------- */

export function ServicesPage() {
  const [s, set] = useGroup("services");
  return (
    <>
      <PageHead title="Services" sub="Reservations, alterations, delivery and gift cards at the till. Each can be switched off for every store." actions={<SavedNote />} />
      <Section title="Reservation and deposits" sub="Customers pay part now and the rest when they collect. Stock is set aside until then.">
        <Toggle label="Allow reservations with a deposit" checked={s.layaway} onChange={(v) => set({ layaway: v })} />
        {s.layaway && (
          <>
            <RowField label="Minimum deposit" sub="Share of the total paid up front.">
              <div className="flex items-center gap-2">
                <Input aria-label="Minimum deposit" className="tnum w-20" value={s.minDepositPct} onChange={(e) => set({ minDepositPct: Math.min(100, num(e.target.value)) })} />
                <span className="text-sm text-muted">%</span>
              </div>
            </RowField>
            <RowField label="Hold items for" sub="After this the reservation shows as overdue.">
              <Days label="Hold days" value={s.holdDays} onChange={(n) => set({ holdDays: n })} />
            </RowField>
            <RowField label="If a reservation is cancelled" sub="What happens to the deposit.">
              <Segmented
                size="sm"
                value={s.cancelRefund}
                onChange={(v) => set({ cancelRefund: v })}
                options={[
                  { value: "wallet", label: "To the ASL Wallet" },
                  { value: "original", label: "Refund it" },
                  { value: "keep", label: "Keep it" },
                ]}
              />
            </RowField>
          </>
        )}
      </Section>

      <Section title="Alterations" sub="Hemming and tailoring booked at the till. Staff pick from this menu and the price goes on the sale.">
        <Toggle label="Offer alterations" checked={s.alterations} onChange={(v) => set({ alterations: v })} />
        {s.alterations && (
          <>
            <div className="border-b border-line py-3">
              <p className="mb-2 text-sm font-medium">Menu and prices</p>
              <div className="space-y-2">
                {s.alterationMenu.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input aria-label={`Alteration ${i + 1} name`} value={m.name} onChange={(e) => set({ alterationMenu: s.alterationMenu.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <Money label={`Alteration ${i + 1} price`} w="w-36" value={m.price} onChange={(n) => set({ alterationMenu: s.alterationMenu.map((x, j) => (j === i ? { ...x, price: n } : x)) })} />
                    <RemoveBtn label={`Remove ${m.name}`} onClick={() => set({ alterationMenu: s.alterationMenu.filter((_, j) => j !== i) })} />
                  </div>
                ))}
              </div>
              <Button size="sm" className="mt-3" icon={<Plus size={15} />} onClick={() => set({ alterationMenu: [...s.alterationMenu, { name: "New alteration", price: 10000 }] })}>
                Add to menu
              </Button>
            </div>
            <RowField label="Free on sales over" sub="Alterations on items bought in that sale cost nothing. Set ₦0 to always charge.">
              <Money label="Free alterations over" value={s.freeAlterationsOver} onChange={(n) => set({ freeAlterationsOver: n })} />
            </RowField>
            <RowField label="Usual turnaround" sub="Sets the ready-by date on new tickets.">
              <Days label="Turnaround" value={s.turnaroundDays} onChange={(n) => set({ turnaroundDays: n })} />
            </RowField>
            <p className="pt-3 text-sm font-medium">Tailors</p>
            <ListEditor items={s.tailors} onChange={(tailors) => set({ tailors })} placeholder="Add a tailor" />
          </>
        )}
      </Section>

      <Section title="Delivery from the till" sub="When an item isn't in the store, staff can sell it and ship it from another store or the warehouse.">
        <Toggle label="Allow ship to customer" checked={s.delivery} onChange={(v) => set({ delivery: v })} />
        {s.delivery && (
          <>
            <div className="border-b border-line py-3">
              <p className="mb-2 text-sm font-medium">Delivery zones</p>
              <div className="space-y-2">
                {s.zones.map((z, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input aria-label={`Zone ${i + 1} name`} className="min-w-[160px] flex-1" value={z.name} onChange={(e) => set({ zones: s.zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <Money label={`Zone ${i + 1} fee`} w="w-32" value={z.fee} onChange={(n) => set({ zones: s.zones.map((x, j) => (j === i ? { ...x, fee: n } : x)) })} />
                    <Days label={`Zone ${i + 1} days`} value={z.days} onChange={(n) => set({ zones: s.zones.map((x, j) => (j === i ? { ...x, days: n } : x)) })} />
                    <RemoveBtn label={`Remove ${z.name}`} onClick={() => set({ zones: s.zones.filter((_, j) => j !== i) })} />
                  </div>
                ))}
              </div>
              <Button size="sm" className="mt-3" icon={<Plus size={15} />} onClick={() => set({ zones: [...s.zones, { name: "New zone", fee: 8000, days: 3 }] })}>
                Add zone
              </Button>
            </div>
            <RowField label="Free delivery on sales over" sub="Set ₦0 to always charge.">
              <Money label="Free delivery over" value={s.freeDeliveryOver} onChange={(n) => set({ freeDeliveryOver: n })} />
            </RowField>
          </>
        )}
      </Section>

      <Section title="Gift cards" sub="Sold and redeemed at the till, website and app. Balances are shared everywhere.">
        <Toggle label="Sell and accept gift cards" checked={s.giftCards} onChange={(v) => set({ giftCards: v })} />
        {s.giftCards && (
          <>
            <RowField label="Amount buttons" sub="Quick amounts on the till. Staff can also type any amount.">
              <div className="flex flex-wrap gap-2">
                {[10000, 25000, 50000, 100000, 250000, 500000].map((v) => {
                  const on = s.giftCardPresets.includes(v);
                  return (
                    <button key={v} aria-pressed={on} onClick={() => set({ giftCardPresets: on ? s.giftCardPresets.filter((x) => x !== v) : [...s.giftCardPresets, v].sort((a, b) => a - b) })} className={cx("tnum h-9 rounded-lg border px-3 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line")}>
                      {naira(v)}
                    </button>
                  );
                })}
              </div>
            </RowField>
            <RowField label="Cards expire after">
              <div className="flex items-center gap-2">
                <Input aria-label="Expiry months" className="tnum w-20" value={s.giftCardExpiryMonths} onChange={(e) => set({ giftCardExpiryMonths: num(e.target.value) })} />
                <span className="text-sm text-muted">months</span>
              </div>
            </RowField>
          </>
        )}
      </Section>
    </>
  );
}

/* ---------------- Commission ---------------- */

const ROLES: Role[] = ["Cashier", "Supervisor", "Manager"];

export function CommissionPage() {
  const [c, set] = useGroup("commission");
  const staff = useDb((s) => s.staff);
  return (
    <>
      <PageHead title="Commission" sub="Sales credit for associates on the floor. The till asks who helped the customer, and Reports shows sales and commission per person." actions={<SavedNote />} />
      <Section title="How it works">
        <Toggle label="Track commission" checked={c.enabled} onChange={(v) => set({ enabled: v })} />
        <RowField label="Credit the sale to" sub="Staff can change the associate per item at the till.">
          <Segmented
            size="sm"
            value={c.attributeBy}
            onChange={(v) => set({ attributeBy: v })}
            options={[
              { value: "associate", label: "Sales associate" },
              { value: "cashier", label: "Whoever rings it up" },
            ]}
          />
        </RowField>
      </Section>
      <Section title="Rates" sub="A percentage of net sales, after discounts.">
        {ROLES.map((r) => (
          <RowField key={r} label={r}>
            <div className="flex items-center gap-2">
              <Input aria-label={`${r} commission`} className="tnum w-20" value={c.rates[r]} onChange={(e) => set({ rates: { ...c.rates, [r]: num(e.target.value) } })} />
              <span className="text-sm text-muted">%</span>
            </div>
          </RowField>
        ))}
      </Section>
      <Section title="Monthly targets" sub="Shown in Reports, with progress for the month so far.">
        {staff
          .filter((p) => p.active)
          .map((p) => (
            <RowField key={p.id} label={p.name} sub={p.role}>
              <Money label={`${p.name} target`} value={c.targets[p.id] ?? 0} onChange={(n) => set({ targets: { ...c.targets, [p.id]: n } })} />
            </RowField>
          ))}
      </Section>
    </>
  );
}
