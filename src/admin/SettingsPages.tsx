import { ReactNode, useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, Crown, Landmark, Plus, Printer, ScanLine, Split, Trash2, Wallet, X } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { applyPosSettingsToLocal, localPatchToPosApi } from "../api/posSettingsMap";
import { useDb } from "../data/store";
import type { Coupon, Settings, Tier } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Input, Segmented, Select, Toggle, cx, toast, timeAgo, TierBadge } from "../ui/kit";
import { Receipt } from "../shared/Receipt";
import { PageHead, RowField, SavedNote, Section, Td, Th } from "./Admin";

const LABELS: Record<keyof Settings, string> = {
  general: "Checkout",
  payments: "Payment methods",
  discounts: "Discounts",
  receipts: "Receipts",
  returns: "Returns",
  cash: "Cash management",
  loyalty: "Loyalty at the till",
  offline: "Offline & sync",
  roles: "Roles",
  services: "Services",
  commission: "Commission",
};

let liveSettingsLoaded = false;

/** Read one settings group and patch it, logging the change once per burst of edits. */
export function useGroup<K extends keyof Settings>(key: K): [Settings[K], (patch: Partial<Settings[K]>) => void] {
  const value = useDb((s) => s.settings[key]);
  const setSettings = useDb((s) => s.setSettings);
  const log = useDb((s) => s.log);
  const timer = useRef<number>();
  useEffect(() => {
    if (!liveMode() || liveSettingsLoaded) return;
    liveSettingsLoaded = true;
    adminPosApi
      .settings()
      .then((pos) => {
        const mapped = applyPosSettingsToLocal(pos as Record<string, unknown>);
        for (const k of Object.keys(mapped) as (keyof Settings)[]) {
          const patch = mapped[k];
          if (patch && Object.keys(patch).length) setSettings(k, patch as Partial<Settings[typeof k]>);
        }
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load POS settings"));
  }, [setSettings]);

  return [
    value,
    (patch) => {
      setSettings(key, patch);
      if (liveMode()) {
        const apiPatch = localPatchToPosApi(key, patch);
        if (Object.keys(apiPatch).length) {
          adminPosApi.patchSettings(apiPatch).catch((e) => toast(e instanceof ApiError ? e.message : "Could not save settings"));
        }
      }
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => log(`${LABELS[key]} settings updated`, "settings"), 1200);
    },
  ];
}

export const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

export function Money({ value, onChange, label, w = "w-40" }: { value: number; onChange: (n: number) => void; label: string; w?: string }) {
  return <Input aria-label={label} prefix="₦" inputMode="numeric" className={cx("tnum", w)} value={value.toLocaleString("en-NG")} onChange={(e) => onChange(num(e.target.value))} />;
}

export function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="py-3">
      <div className="flex flex-wrap gap-2">
        {items.map((r) => (
          <span key={r} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-canvas pl-3 pr-1 text-[13px]">
            {r}
            <button aria-label={`Remove ${r}`} onClick={() => onChange(items.filter((x) => x !== r))} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-white hover:text-bad">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !items.includes(draft.trim())) onChange([...items, draft.trim()]);
          setDraft("");
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-10" />
        <Button size="sm" type="submit" className="h-10" icon={<Plus size={15} />}>
          Add
        </Button>
      </form>
    </div>
  );
}

function Method({ icon, title, sub, on, onToggle, children }: { icon: ReactNode; title: string; sub: string; on: boolean; onToggle: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-[13px] text-muted">{sub}</p>
        </div>
        <Toggle ariaLabel={`Accept ${title}`} checked={on} onChange={onToggle} />
      </div>
      {on && children && <div className="border-t border-line px-5 py-2">{children}</div>}
    </div>
  );
}

/* ---------------- Payment methods ---------------- */

export function PaymentsPage() {
  const [p, set] = useGroup("payments");
  const registers = useDb((s) => s.registers);
  const stores = useDb((s) => s.stores);
  const [loyalty, setLoyalty] = useGroup("loyalty");
  return (
    <>
      <PageHead title="Payment methods" sub="What the tills can take. Card and transfer are taken on your own terminal and bank account; the till records them against the sale." actions={<SavedNote />} />
      <div className="space-y-3">
        <Method icon={<Banknote size={19} />} title="Cash" sub="With change worked out and the drawer opened automatically." on={p.cash} onToggle={(v) => set({ cash: v })}>
          <RowField label="Quick cash buttons" sub="Shown on the payment screen next to Exact.">
            <div className="flex flex-wrap gap-2">
              {[1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000].map((v) => {
                const onB = p.quickTender.includes(v);
                return (
                  <button key={v} aria-pressed={onB} onClick={() => set({ quickTender: onB ? p.quickTender.filter((x) => x !== v) : [...p.quickTender, v].sort((a, b) => a - b) })} className={cx("tnum h-9 rounded-lg border px-3 text-[13px]", onB ? "border-ink bg-ink text-white" : "border-line")}>
                    {naira(v)}
                  </button>
                );
              })}
            </div>
          </RowField>
        </Method>
        <Method icon={<CreditCard size={19} />} title="Card on terminal" sub="The cashier charges the card on the POS terminal, then records the approval code." on={p.card} onToggle={(v) => set({ card: v })}>
          <RowField label="Terminal provider">
            <Select value={p.cardProvider} onChange={(e) => set({ cardProvider: e.target.value })} className="w-52">
              {["Moniepoint", "Paystack Terminal", "OPay", "Interswitch", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </RowField>
          <RowField label="Terminals" sub="Set per register in Registers.">
            <ul className="space-y-1 text-[13px]">
              {registers.map((r) => (
                <li key={r.id} className="tnum">
                  {stores.find((s) => s.id === r.storeId)?.name.split(" ")[0]} {r.name}: <span className="text-muted">{r.terminalId || "none"}</span>
                </li>
              ))}
            </ul>
          </RowField>
        </Method>
        <Method icon={<Landmark size={19} />} title="Bank transfer" sub="The till shows these details to the customer, and the cashier confirms the money arrived." on={p.transfer} onToggle={(v) => set({ transfer: v })}>
          {p.transferAccounts.map((a, i) => (
            <div key={i} className="grid gap-2 border-b border-line py-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              {(["bank", "name", "number"] as const).map((k) => (
                <Input key={k} aria-label={k} value={a[k]} placeholder={k === "bank" ? "Bank" : k === "name" ? "Account name" : "Account number"} onChange={(e) => set({ transferAccounts: p.transferAccounts.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />
              ))}
              <Button variant="ghost" aria-label="Remove account" onClick={() => set({ transferAccounts: p.transferAccounts.filter((_, j) => j !== i) })}>
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <div className="py-3">
            <Button size="sm" icon={<Plus size={15} />} onClick={() => set({ transferAccounts: [...p.transferAccounts, { bank: "", name: "ASL ORIGINALS Ltd", number: "" }] })}>
              Add account
            </Button>
          </div>
          <Toggle label="Ask for the sender's name or reference" checked={p.transferNeedsRef} onChange={(v) => set({ transferNeedsRef: v })} />
        </Method>
        <Method icon={<Wallet size={19} />} title="ASL Wallet" sub="Pay from the same wallet the customer tops up and spends in the app. Refunds and cancelled deposits can go back to it." on={p.wallet} onToggle={(v) => set({ wallet: v })} />
        <Method icon={<Crown size={19} />} title="Loyalty points" sub={`Customers pay with points at ${naira(loyalty.pointValue)} each. Set the rules in Loyalty at the till.`} on={p.points && loyalty.redeemAtPos} onToggle={(v) => { set({ points: v }); setLoyalty({ redeemAtPos: v }); }} />
        <Method icon={<Split size={19} />} title="Split payments" sub="Pay one sale with more than one method, for example part card and part cash." on={p.split} onToggle={(v) => set({ split: v })} />
      </div>
    </>
  );
}

/* ---------------- Checkout & discounts ---------------- */

export function CheckoutPage() {
  const [g, setG] = useGroup("general");
  const [d, setD] = useGroup("discounts");
  const db = useDb();
  const live = liveMode();

  useEffect(() => {
    if (!live) return;
    adminPosApi
      .coupons()
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).map((c: any) => ({
          code: c.code,
          label: c.title ?? c.code,
          type: c.type === "fixed" ? ("fixed" as const) : ("percent" as const),
          value: c.type === "fixed" ? fromKobo(c.value ?? 0) : c.value ?? 0,
          minSpend: c.minSubtotal != null ? fromKobo(c.minSubtotal) : 0,
          maxDiscount: c.maxDiscount != null ? fromKobo(c.maxDiscount) : undefined,
          active: c.status === "active",
          channels: (c.channels ?? []) as Coupon["channels"],
          expires: c.endsAt ? (typeof c.endsAt === "string" ? c.endsAt : new Date(c.endsAt).toISOString()) : new Date(Date.now() + 365 * 86400e3).toISOString(),
          _id: c.id,
        }));
        useDb.setState({ coupons: list as Coupon[] });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load coupons"));
  }, [live]);

  return (
    <>
      <PageHead title="Checkout & discounts" sub="Tax, discount rules and which promotions can be used in store. Coupons themselves are created in Promotions." actions={<SavedNote />} />
      <Section title="Tax" sub="Prices on products already include VAT. Receipts show the VAT part.">
        <RowField label="VAT rate">
          <Input aria-label="VAT rate" className="tnum w-24" value={g.vatRate} onChange={(e) => setG({ vatRate: num(e.target.value) })} />
        </RowField>
        <Toggle label="Prices include VAT" checked={g.pricesIncludeVat} onChange={(v) => setG({ pricesIncludeVat: v })} />
      </Section>
      <Section title="At checkout">
        <RowField label="Ask for a customer on sales over" sub="Set to ₦0 to never ask. Helps loyalty and returns.">
          <Money label="Customer required over" value={g.requireCustomerOver} onChange={(n) => setG({ requireCustomerOver: n })} />
        </RowField>
      </Section>
      <Section title="Manual discounts" sub="How far each role can go without a manager is set in Staff & roles.">
        <RowField label="Limits by role">
          <span className="tnum text-[13px]">
            Cashier {d.limits.Cashier}% · Supervisor {d.limits.Supervisor}% · Manager {d.limits.Manager}%{" "}
            <a href="#pos-staff" className="ml-2 font-medium text-gold-ink hover:underline">
              Change
            </a>
          </span>
        </RowField>
        <Toggle label="Reason required" description="Staff pick a reason from the list below for every discount." checked={d.requireReason} onChange={(v) => setD({ requireReason: v })} />
        <ListEditor items={d.reasons} onChange={(reasons) => setD({ reasons })} placeholder="Add a reason" />
      </Section>
      <Section title="Coupons in store" sub="Codes come from Promotions. Choose which ones work at the tills too.">
        <Toggle label="Allow coupon codes at the till" checked={d.couponsAtPos} onChange={(v) => setD({ couponsAtPos: v })} />
        <Toggle label="Allow a coupon with a manual discount" checked={d.stackCoupons} onChange={(v) => setD({ stackCoupons: v })} />
        <div className="thin-scroll -mx-5 overflow-x-auto border-t border-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Offer</Th>
                <Th>Status</Th>
                <Th right>Use in store</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {db.coupons.map((c) => (
                <tr key={c.code}>
                  <Td className="font-mono text-[13px] font-medium">{c.code}</Td>
                  <Td className="text-ink-2">
                    {c.label}
                    <span className="block text-xs text-muted">{c.channels.map((ch) => ({ web: "Website", mobile: "App", concierge: "Concierge", store: "In store" })[ch]).join(" · ")}</span>
                  </Td>
                  <Td>{c.active ? <Badge tone="good">Running</Badge> : <Badge>Ended</Badge>}</Td>
                  <Td right>
                    <span className="inline-flex">
                      <Toggle
                        ariaLabel={`Use ${c.code} in store`}
                        checked={c.channels.includes("store")}
                        disabled={!d.couponsAtPos}
                        onChange={async (v) => {
                          const channels = v ? [...c.channels.filter((ch) => ch !== "store"), "store" as const] : c.channels.filter((ch) => ch !== "store");
                          const next = channels.length ? channels : (["web"] as Coupon["channels"]);
                          const prev = db.coupons;
                          useDb.setState({ coupons: prev.map((x) => (x.code === c.code ? { ...x, channels: next } : x)) });
                          if (live) {
                            const id = (c as Coupon & { _id?: string })._id;
                            if (!id) return;
                            try {
                              await adminPosApi.patchCouponChannels(id, next);
                            } catch (e) {
                              toast(e instanceof ApiError ? e.message : "Could not update coupon");
                              useDb.setState({ coupons: prev });
                            }
                          }
                        }}
                      />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/* ---------------- Receipts ---------------- */

export function ReceiptsPage() {
  const [r, set] = useGroup("receipts");
  const db = useDb();
  const sample = db.orders.find((o) => o.channel === "pos" && o.customerId && o.lines.length > 1) ?? db.orders[0];
  const preview = sample
    ? { ...sample, pointsEarned: sample.pointsEarned || 120, staffId: sample.staffId ?? "s3" }
    : null;
  return (
    <>
      <PageHead title="Receipts" sub="What goes on printed and digital receipts. The preview updates as you change things." actions={<SavedNote />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white px-5 py-2 shadow-card">
            <RowField label="Message at the top">
              <Input aria-label="Header" className="w-full sm:w-80" value={r.header} onChange={(e) => set({ header: e.target.value })} />
            </RowField>
            <RowField label="Message at the bottom">
              <Input aria-label="Footer" className="w-full sm:w-80" value={r.footer} onChange={(e) => set({ footer: e.target.value })} />
            </RowField>
            <RowField label="Paper">
              <Segmented size="sm" value={r.paper} onChange={(v) => set({ paper: v })} options={[{ value: "80mm", label: "80mm" }, { value: "58mm", label: "58mm" }, { value: "A4", label: "A4" }]} />
            </RowField>
          </div>
          <div className="rounded-xl border border-line bg-white px-5 py-1 shadow-card">
            <Toggle label="Show VAT" checked={r.showVat} onChange={(v) => set({ showVat: v })} />
            <Toggle label="Show loyalty points" description="Points earned and used on this sale." checked={r.showLoyalty} onChange={(v) => set({ showLoyalty: v })} />
            <Toggle label="Show the returns policy" description="Uses the return window from Returns & exchanges." checked={r.showPolicy} onChange={(v) => set({ showPolicy: v })} />
            <Toggle label="Show a QR code" description="Links to the order, for quick returns." checked={r.showQr} onChange={(v) => set({ showQr: v })} />
            <Toggle label="Show who served" checked={r.showStaff} onChange={(v) => set({ showStaff: v })} />
            <Toggle label="Offer gift receipts" description="Prints a copy without prices." checked={r.giftReceipts} onChange={(v) => set({ giftReceipts: v })} />
          </div>
          <div className="rounded-xl border border-line bg-white px-5 py-1 shadow-card">
            <p className="pt-3 text-sm font-semibold">Ways to send a receipt</p>
            {(["print", "email", "sms", "whatsapp"] as const).map((c) => (
              <Toggle key={c} label={{ print: "Print", email: "Email", sms: "SMS", whatsapp: "WhatsApp" }[c]} checked={r.channels[c]} onChange={(v) => set({ channels: { ...r.channels, [c]: v } })} />
            ))}
          </div>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-[13px] font-medium text-muted">Preview</p>
          <div className="rounded-xl bg-[#ece9e3] p-5">
            {preview ? (
              <Receipt order={preview} className="shadow-card" />
            ) : (
              <p className="rounded-lg bg-white p-6 text-sm text-muted shadow-card">Complete a till sale to preview a receipt here.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Returns ---------------- */

export function ReturnsPage() {
  const [r, set] = useGroup("returns");
  return (
    <>
      <PageHead title="Returns & exchanges" sub="Rules the till follows when someone brings something back, including orders bought online." actions={<SavedNote />} />
      <Section title="Eligibility">
        <RowField label="Return window" sub="Days from purchase. Older orders need a manager.">
          <div className="flex items-center gap-2">
            <Input aria-label="Return window" className="tnum w-20" value={r.windowDays} onChange={(e) => set({ windowDays: num(e.target.value) })} />
            <span className="text-sm text-muted">days</span>
          </div>
        </RowField>
        <Toggle label="Receipt or order number required" description="Without one, only roles allowed to refund without a receipt can proceed." checked={r.requireReceipt} onChange={(v) => set({ requireReceipt: v })} />
        <Toggle label="Accept website and app orders in store" checked={r.onlineOrdersInStore} onChange={(v) => set({ onlineOrdersInStore: v })} />
        <Toggle label="Allow exchanges" description="Swap for other items, paying or refunding the difference." checked={r.exchanges} onChange={(v) => set({ exchanges: v })} />
      </Section>
      <Section title="Refunds">
        <p className="pt-3 text-sm font-medium">Refund to</p>
        <Toggle label="The original payment method" checked={r.toOriginal} onChange={(v) => set({ toOriginal: v })} />
        <Toggle label="ASL Wallet" checked={r.toCredit} onChange={(v) => set({ toCredit: v })} />
        <Toggle label="Cash, whatever the original method" checked={r.toCash} onChange={(v) => set({ toCash: v })} />
        <RowField label="Manager approval for refunds over">
          <Money label="Approval over" value={r.approvalOver} onChange={(n) => set({ approvalOver: n })} />
        </RowField>
        <Toggle label="Put returned items back in stock by default" checked={r.restockDefault} onChange={(v) => set({ restockDefault: v })} />
      </Section>
      <Section title="Reasons" sub="Staff pick one for every return. Used in reports.">
        <ListEditor items={r.reasons} onChange={(reasons) => set({ reasons })} placeholder="Add a reason" />
      </Section>
    </>
  );
}

/* ---------------- Cash ---------------- */

export function CashPage() {
  const [c, set] = useGroup("cash");
  return (
    <>
      <PageHead title="Cash management" sub="Opening floats, counting the drawer at close, and paying cash in and out." actions={<SavedNote />} />
      <Section title="Opening and closing">
        <RowField label="Default opening float">
          <Money label="Default float" value={c.defaultFloat} onChange={(n) => set({ defaultFloat: n })} />
        </RowField>
        <Toggle label="Blind close" description="Staff count the drawer without seeing what's expected. Reduces fudged counts." checked={c.blindClose} onChange={(v) => set({ blindClose: v })} />
        <RowField label="Accept a difference of up to" sub="Bigger differences need a note and are flagged in Session history.">
          <Money label="Tolerance" value={c.tolerance} onChange={(n) => set({ tolerance: n })} w="w-32" />
        </RowField>
        <RowField label="Notes and coins to count">
          <div className="flex flex-wrap gap-2">
            {[1000, 500, 200, 100, 50, 20, 10, 5].map((v) => {
              const on = c.denominations.includes(v);
              return (
                <button key={v} aria-pressed={on} onClick={() => set({ denominations: on ? c.denominations.filter((x) => x !== v) : [...c.denominations, v].sort((a, b) => b - a) })} className={cx("tnum h-9 rounded-lg border px-3 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line")}>
                  {naira(v)}
                </button>
              );
            })}
          </div>
        </RowField>
      </Section>
      <Section title="Paying in" sub="Reasons staff choose when adding cash to the drawer.">
        <ListEditor items={c.inReasons} onChange={(inReasons) => set({ inReasons })} placeholder="Add a reason" />
      </Section>
      <Section title="Paying out" sub="Reasons staff choose when taking cash out.">
        <ListEditor items={c.outReasons} onChange={(outReasons) => set({ outReasons })} placeholder="Add a reason" />
      </Section>
    </>
  );
}

/* ---------------- Loyalty ---------------- */

export function LoyaltyPage() {
  const [l, set] = useGroup("loyalty");
  const tiers = Object.keys(l.multipliers) as Tier[];
  return (
    <>
      <PageHead title="Loyalty at the till" sub="In-store sales use the same ASL Club programme as the website and app. Tiers, points and the ASL Wallet are shared, so a customer sees one balance everywhere." actions={<SavedNote />} />
      <Section
        title="ASL Club rules"
        sub="Set once on the ASL Club page and used by the website, app and tills alike. Shown here so store managers know how in-store sales earn."
        aside={
          <a href="#admin-club" className="mt-3 inline-flex text-[13px] font-medium text-gold-ink underline-offset-2 hover:underline">
            Edit in Customers → ASL Club
          </a>
        }
      >
        <RowField label="Points earned" sub="Base points, then the tier multiplier.">
          <span className="tnum text-sm font-medium">1 point per {naira(l.earnPer)}</span>
        </RowField>
        <RowField label="Point value when redeemed">
          <span className="tnum text-sm font-medium">{naira(l.pointValue)} a point</span>
        </RowField>
        <RowField label="Birthday bonus">
          <span className="tnum text-sm font-medium">{l.birthdayBonus.toLocaleString()} points</span>
        </RowField>
        <div className="py-3">
          <p className="mb-2 text-sm font-medium">Tiers by lifetime spend</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiers.map((t) => (
              <div key={t} className="rounded-lg border border-line p-3">
                <TierBadge tier={t} />
                <p className="tnum mt-2 text-lg font-semibold">{l.multipliers[t]}×</p>
                <p className="tnum text-xs text-muted">{l.minSpend[t] ? `From ${naira(l.minSpend[t])}` : "Everyone"}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section title="At the till" sub="Only these settings are POS-specific.">
        <Toggle label="Earn points on in-store sales" checked={l.earnAtPos} onChange={(v) => set({ earnAtPos: v })} />
        <Toggle label="Pay with points at the till" checked={l.redeemAtPos} onChange={(v) => set({ redeemAtPos: v })} />
        <RowField label="Fewest points to redeem" sub="400 points is the cheapest ASL Club reward (₦10,000 store credit).">
          <Input aria-label="Minimum points" className="tnum w-24" value={l.minRedeem} onChange={(e) => set({ minRedeem: num(e.target.value) })} />
        </RowField>
      </Section>
    </>
  );
}

/* ---------------- Hardware ---------------- */

export function HardwarePage() {
  const db = useDb();
  const live = liveMode();
  const [regs, setRegs] = useState(db.registers);

  useEffect(() => {
    setRegs(db.registers);
  }, [db.registers]);

  useEffect(() => {
    if (!live) return;
    adminPosApi
      .registers()
      .then((rows) => {
        setRegs(
          (rows as { id: string; name: string; locationId: string; locationName: string | null; warehouseId: string; device: string | null; printer: string | null; terminalId: string | null; drawer: boolean; scanner: string | null }[]).map(
            (r) => ({
              id: r.id,
              name: r.name,
              storeId: r.locationId,
              warehouseId: r.warehouseId,
              device: r.device ?? "",
              printer: r.printer ?? "Epson TM-m30III",
              terminalId: r.terminalId ?? "",
              drawer: r.drawer,
              scanner: r.scanner ?? "Camera",
              online: false,
              lastSeen: new Date().toISOString(),
            }),
          ),
        );
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load registers"));
  }, [live]);

  const saveRegister = async (r: (typeof regs)[number], patch: Partial<(typeof regs)[number]>) => {
    const next = { ...r, ...patch };
    if (live) {
      const warehouseId = r.warehouseId ?? db.stores.find((s) => s.id === r.storeId)?.warehouseId;
      if (!warehouseId) {
        toast("This store needs a stock warehouse before you can save");
        return;
      }
      try {
        await adminPosApi.upsertRegister({
          id: r.id,
          locationId: r.storeId,
          warehouseId,
          name: next.name,
          device: next.device || undefined,
          printer: next.printer || undefined,
          terminalId: next.terminalId || undefined,
          drawer: next.drawer,
          scanner: next.scanner || undefined,
          active: true,
        });
        setRegs((xs) => xs.map((x) => (x.id === r.id ? next : x)));
        toast("Register saved");
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Could not save register");
      }
      return;
    }
    db.upsertRegister(next);
    setRegs((xs) => xs.map((x) => (x.id === r.id ? next : x)));
  };

  return (
    <>
      <PageHead title="Hardware" sub="Printers, scanners, cash drawers and card terminals connected to each register." />
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-canvas/60">
              <tr>
                <Th>Register</Th>
                <Th>Receipt printer</Th>
                <Th>Barcode scanner</Th>
                <Th>Cash drawer</Th>
                <Th>Card terminal</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {regs.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">
                    {db.stores.find((s) => s.id === r.storeId)?.name} · {r.name}
                    <span className="block text-xs font-normal text-muted">{r.device}</span>
                  </Td>
                  <Td>{r.printer}</Td>
                  <Td>
                    <Select aria-label={`${r.name} scanner`} value={r.scanner} onChange={(e) => saveRegister(r, { scanner: e.target.value })} className="h-9 w-48">
                      {["Zebra DS2208", "Honeywell Voyager 1250g", "Socket Mobile S700", "Camera"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td>{r.drawer ? <Badge tone="good">Connected</Badge> : <Badge>None</Badge>}</Td>
                  <Td className="tnum text-ink-2">{r.terminalId || "—"}</Td>
                  <Td right>
                    <Button size="sm" variant="ghost" icon={<Printer size={15} />} onClick={() => toast(`Test page sent to ${r.printer}`)}>
                      Test
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          { icon: <Printer size={18} />, t: "Receipt printers", b: "Epson TM-m30III and Star mC-Print3 over Wi-Fi or Bluetooth. 58mm and 80mm paper." },
          { icon: <ScanLine size={18} />, t: "Scanners", b: "Any USB or Bluetooth scanner in keyboard mode, or the tablet's camera." },
          { icon: <CreditCard size={18} />, t: "Card terminals", b: "Standalone terminals. The cashier records the approval code on the till." },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-white p-5 shadow-card">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-canvas">{x.icon}</span>
            <p className="font-semibold">{x.t}</p>
            <p className="mt-1 text-[13px] text-muted">{x.b}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Offline ---------------- */

export function OfflinePage() {
  const [o, set] = useGroup("offline");
  const db = useDb();
  return (
    <>
      <PageHead title="Offline & sync" sub="Tills keep selling when the internet drops, then send everything to the admin when it's back." actions={<SavedNote />} />
      <Section title="Selling offline">
        <Toggle label="Allow sales while offline" checked={o.allowed} onChange={(v) => set({ allowed: v })} />
        <RowField label="Largest sale allowed offline" sub="Bigger sales wait until the till is back online.">
          <Money label="Largest offline sale" value={o.maxSale} onChange={(n) => set({ maxSale: n })} />
        </RowField>
        <Toggle label="Hand over pickups while offline" description="Off means the till must confirm the pickup code with the admin first." checked={o.pickupsOffline} onChange={(v) => set({ pickupsOffline: v })} />
      </Section>
      <Section title="Stock" sub="Offline tills only know the stock they last saw, so two channels can sell the last item.">
        <RowField label="When the last item has already sold elsewhere">
          <Segmented size="sm" value={o.oversell} onChange={(v) => set({ oversell: v })} options={[{ value: "allow", label: "Allow" }, { value: "warn", label: "Warn" }, { value: "block", label: "Block" }]} />
        </RowField>
        <RowField label="Refresh prices and stock every">
          <Select value={o.syncSeconds} onChange={(e) => set({ syncSeconds: Number(e.target.value) })} className="w-40">
            {[10, 30, 60, 300].map((s) => (
              <option key={s} value={s}>
                {s < 60 ? `${s} seconds` : `${s / 60} minute${s > 60 ? "s" : ""}`}
              </option>
            ))}
          </Select>
        </RowField>
      </Section>
      <Section title="Devices">
        <ul className="divide-y divide-line">
          {db.registers.map((r) => {
            const pending = db.orders.filter((x) => x.registerId === r.id && !x.synced).length;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${r.online ? "bg-good" : "bg-faint"}`} />
                <span className="flex-1">
                  {db.stores.find((s) => s.id === r.storeId)?.name} · {r.name}
                </span>
                {pending > 0 && <Badge tone="warn">{pending} to sync</Badge>}
                <span className="text-[13px] text-muted">{r.online ? "Online" : `Last seen ${timeAgo(r.lastSeen)}`}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
