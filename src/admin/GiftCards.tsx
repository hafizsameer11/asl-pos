import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Gift, Plus, SlidersHorizontal } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo, toKobo } from "../api/money";
import { adminPosApi, posApi } from "../api/pos";
import { useDb } from "../data/store";
import type { GiftCard } from "../data/types";
import { naira } from "../lib/pricing";
import { Badge, Button, Dialog, Empty, Field, Input, SearchBox, Select, Sheet, Stat, cx, fmtDate, toast, type Tone } from "../ui/kit";
import { PageHead, Td, Th } from "./Admin";

const STATUS: Record<GiftCard["status"], [string, Tone]> = { active: ["Active", "good"], used: ["Used up", "neutral"], cancelled: ["Cancelled", "bad"] };
const KIND: Record<GiftCard["history"][number]["kind"], string> = { issued: "Issued", redeemed: "Spent", refunded: "Refunded to card", adjusted: "Adjusted" };

const code = () => `GC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
const money = (v: string) => Number(v.replace(/\D/g, "")) || 0;

type ApiGiftCard = {
  id: string;
  code: string;
  initial: number;
  balance: number;
  issuedAt: string;
  expiresAt: string;
  status: GiftCard["status"];
  locationId: string | null;
  customerId: string | null;
  events?: { at: string; amount: number; kind: GiftCard["history"][number]["kind"]; ref: string | null }[];
};

function mapGiftCard(g: ApiGiftCard): GiftCard {
  return {
    code: g.code,
    initial: fromKobo(g.initial),
    balance: fromKobo(g.balance),
    issuedAt: typeof g.issuedAt === "string" ? g.issuedAt : new Date(g.issuedAt).toISOString(),
    expires: typeof g.expiresAt === "string" ? g.expiresAt : new Date(g.expiresAt).toISOString(),
    status: g.status,
    storeId: g.locationId ?? undefined,
    customerId: g.customerId ?? undefined,
    history: (g.events ?? []).map((e) => ({
      at: typeof e.at === "string" ? e.at : new Date(e.at).toISOString(),
      amount: fromKobo(e.amount),
      kind: e.kind,
      ref: e.ref ?? "",
    })),
  };
}

export default function GiftCards() {
  const dbCards = useDb((s) => s.giftCards);
  const customers = useDb((s) => s.customers);
  const stores = useDb((s) => s.stores);
  const live = liveMode();
  const [remote, setRemote] = useState<GiftCard[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const load = useCallback(() => {
    if (!live) return;
    adminPosApi
      .giftCards(q.trim() || undefined)
      .then((rows) => setRemote((rows as ApiGiftCard[]).map(mapGiftCard)))
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load gift cards"));
  }, [live, q]);

  useEffect(() => {
    if (!live) return;
    const t = window.setTimeout(load, q.trim() ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [live, load, q]);

  const cards = live ? remote : dbCards;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s/g, "");
    return cards.filter((g) => (status === "all" || g.status === status) && (!t || g.code.toLowerCase().replace(/-/g, "").includes(t.replace(/-/g, "")) || customers.find((c) => c.id === g.customerId)?.name.toLowerCase().includes(t)));
  }, [cards, customers, q, status]);
  const stats = useMemo(() => {
    const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const hist = cards.flatMap((g) => g.history).filter((h) => new Date(h.at).getTime() >= month);
    return {
      liability: cards.filter((g) => g.status === "active").reduce((a, g) => a + g.balance, 0),
      active: cards.filter((g) => g.status === "active").length,
      sold: hist.filter((h) => h.kind === "issued").reduce((a, h) => a + h.amount, 0),
      soldCount: hist.filter((h) => h.kind === "issued").length,
      redeemed: -hist.filter((h) => h.kind === "redeemed").reduce((a, h) => a + h.amount, 0),
    };
  }, [cards]);
  const card = cards.find((g) => g.code === open);

  return (
    <>
      <PageHead
        title="Gift cards"
        sub="Cards sold at the tills, website and app, with one shared balance. Staff sell them from the till and take them as payment; you can issue, adjust or cancel them here."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setIssuing(true)}>
            Issue a card
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding balance" value={naira(stats.liability)} sub="Owed to customers on active cards" />
        <Stat label="Active cards" value={stats.active} />
        <Stat label="Sold this month" value={naira(stats.sold)} sub={`${stats.soldCount} cards`} />
        <Stat label="Spent this month" value={naira(stats.redeemed)} />
      </div>
      <div className="my-4 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Card number or customer" className="w-full sm:w-72" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="all">All cards</option>
          <option value="active">Active</option>
          <option value="used">Used up</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="tnum w-full text-[13px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <Th>Card</Th>
                <Th>Customer</Th>
                <Th>Issued</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((g) => (
                <tr key={g.code} onClick={() => setOpen(g.code)} className="cursor-pointer hover:bg-canvas/60" data-testid="giftcard-row">
                  <Td className="font-mono font-medium">{g.code}</Td>
                  <Td>{customers.find((c) => c.id === g.customerId)?.name ?? <span className="text-faint">Not linked</span>}</Td>
                  <Td>
                    {fmtDate(g.issuedAt)}
                    <span className="block text-xs text-muted">{stores.find((s) => s.id === g.storeId)?.name ?? "Website"}</span>
                  </Td>
                  <Td className={cx(new Date(g.expires).getTime() - Date.now() < 30 * 86400e3 && g.status === "active" && "text-warn")}>{fmtDate(g.expires)}</Td>
                  <Td>
                    <Badge tone={STATUS[g.status][1]}>{STATUS[g.status][0]}</Badge>
                  </Td>
                  <Td right>
                    <span className="font-medium">{naira(g.balance)}</span>
                    <span className="block text-xs text-muted">of {naira(g.initial)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<Gift size={20} />} title="No cards match" />
      )}
      {card && <Detail card={card} live={live} onClose={() => setOpen(null)} onChanged={load} />}
      {issuing && <Issue live={live} onClose={() => setIssuing(false)} onDone={(c) => (setIssuing(false), setOpen(c), load())} />}
    </>
  );
}

function Detail({ card, live, onClose, onChanged }: { card: GiftCard; live: boolean; onClose: () => void; onChanged: () => void }) {
  const customers = useDb((s) => s.customers);
  const upsert = useDb((s) => s.upsertGiftCard);
  const log = useDb((s) => s.log);
  const [adjusting, setAdjusting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const customer = customers.find((c) => c.id === card.customerId);
  return (
    <Sheet
      title={<span className="font-mono">{card.code}</span>}
      sub={customer ? `${customer.name} · ${customer.phone}` : "Not linked to a customer"}
      onClose={onClose}
      footer={
        card.status === "active" ? (
          <>
            <Button icon={<SlidersHorizontal size={16} />} onClick={() => setAdjusting(true)}>
              Adjust balance
            </Button>
            <Button variant="danger" className="ml-auto" icon={<Ban size={16} />} onClick={() => setConfirmCancel(true)}>
              Cancel card
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="p-6">
        <div className="rounded-xl bg-ink p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">ASL ORIGINALS gift card</p>
          <p className="tnum mt-6 text-3xl font-semibold">{naira(card.balance)}</p>
          <p className="tnum mt-1 text-[13px] text-white/60">
            of {naira(card.initial)} · expires {fmtDate(card.expires)}
          </p>
          <p className="mt-4 font-mono text-sm tracking-wider">{card.code}</p>
        </div>
        <h3 className="mb-2 mt-6 text-sm font-semibold">History</h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {[...card.history].reverse().map((h, i) => (
            <li key={i} className="tnum flex items-center justify-between px-4 py-2.5 text-[13px]">
              <span>
                <span className="block font-medium">{KIND[h.kind]}</span>
                <span className="text-xs text-muted">
                  {fmtDate(h.at)} · {h.ref}
                </span>
              </span>
              <span className={cx("font-medium", h.amount < 0 ? "text-ink" : "text-good")}>
                {h.amount > 0 ? "+" : ""}
                {naira(h.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {adjusting && (
        <Adjust
          card={card}
          onClose={() => setAdjusting(false)}
          onSave={async (delta, reason) => {
            if (live) {
              try {
                await adminPosApi.adjustGiftCard(card.code, { amount: toKobo(delta), note: reason });
                toast(`Balance updated`);
                setAdjusting(false);
                onChanged();
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Adjust failed");
              }
              return;
            }
            const balance = Math.max(0, card.balance + delta);
            upsert({ ...card, balance, status: balance === 0 ? "used" : "active", history: [...card.history, { at: new Date().toISOString(), amount: balance - card.balance, kind: "adjusted", ref: reason }] });
            log(`Gift card ${card.code} adjusted by ${naira(delta)} (${reason})`, "settings");
            toast(`Balance is now ${naira(balance)}`);
            setAdjusting(false);
          }}
        />
      )}
      {confirmCancel && (
        <Dialog
          title="Cancel this card?"
          sub={`The ${naira(card.balance)} balance can no longer be spent. Use this for lost or stolen cards; issue a replacement for the customer.`}
          size="sm"
          onClose={() => setConfirmCancel(false)}
          footer={
            <>
              <Button onClick={() => setConfirmCancel(false)}>Keep it</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (live) {
                    try {
                      await adminPosApi.adjustGiftCard(card.code, { amount: 0, note: "Cancelled", cancel: true });
                      toast("Card cancelled");
                      setConfirmCancel(false);
                      onClose();
                      onChanged();
                    } catch (e) {
                      toast(e instanceof ApiError ? e.message : "Cancel failed");
                    }
                    return;
                  }
                  upsert({ ...card, status: "cancelled", history: [...card.history, { at: new Date().toISOString(), amount: -card.balance, kind: "adjusted", ref: "Cancelled" }], balance: 0 });
                  log(`Gift card ${card.code} cancelled`, "settings");
                  toast("Card cancelled");
                  setConfirmCancel(false);
                }}
              >
                Cancel card
              </Button>
            </>
          }
        >
          <span />
        </Dialog>
      )}
    </Sheet>
  );
}

function Adjust({ card, onClose, onSave }: { card: GiftCard; onClose: () => void; onSave: (delta: number, reason: string) => void | Promise<void> }) {
  const [dir, setDir] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Goodwill");
  const n = money(amount);
  return (
    <Dialog
      title="Adjust balance"
      sub={`Now ${naira(card.balance)}. Recorded in the card's history.`}
      size="sm"
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!n || !reason.trim()} onClick={() => onSave(dir * n, reason.trim())}>
          {dir > 0 ? "Add" : "Remove"} {naira(n)}
        </Button>
      }
    >
      <div className="flex gap-2">
        <Button size="sm" variant={dir > 0 ? "primary" : "secondary"} onClick={() => setDir(1)}>
          Add
        </Button>
        <Button size="sm" variant={dir < 0 ? "primary" : "secondary"} onClick={() => setDir(-1)}>
          Remove
        </Button>
      </div>
      <Field label="Amount" className="mt-4">
        <Input aria-label="Amount" prefix="₦" inputMode="numeric" className="tnum" value={n ? n.toLocaleString("en-NG") : ""} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Reason" className="mt-4">
        <Input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function Issue({ live, onClose, onDone }: { live: boolean; onClose: () => void; onDone: (code: string) => void }) {
  const customers = useDb((s) => s.customers);
  const svc = useDb((s) => s.settings.services);
  const upsert = useDb((s) => s.upsertGiftCard);
  const log = useDb((s) => s.log);
  const [amount, setAmount] = useState(svc.giftCardPresets[1] ?? 50000);
  const [customerId, setCustomerId] = useState("");
  const [customerQ, setCustomerQ] = useState("");
  const [customerHits, setCustomerHits] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [reason, setReason] = useState("Customer goodwill");

  useEffect(() => {
    if (!live || customerQ.trim().length < 2) {
      setCustomerHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      posApi
        .searchCustomers(customerQ.trim())
        .then((rows) => setCustomerHits(rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))))
        .catch(() => setCustomerHits([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [live, customerQ]);
  return (
    <Dialog
      title="Issue a gift card"
      sub="For goodwill, prizes or replacing a lost card. Cards sold to customers are issued at the till."
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!amount}
          onClick={async () => {
            if (live) {
              try {
                const out = (await adminPosApi.issueGiftCard(amount, { customerId: customerId || undefined })) as { code: string };
                toast(`Issued ${out.code}`);
                onDone(out.code);
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Could not issue gift card");
              }
              return;
            }
            const c = code();
            const now = new Date().toISOString();
            upsert({ code: c, initial: amount, balance: amount, issuedAt: now, customerId: customerId || undefined, expires: new Date(Date.now() + svc.giftCardExpiryMonths * 30.4 * 86400e3).toISOString(), status: "active", history: [{ at: now, amount, kind: "issued", ref: reason || "Issued in admin" }] });
            log(`Gift card ${c} issued for ${naira(amount)} (${reason})`, "settings");
            toast(`Issued ${c}. The customer gets it by email and SMS.`);
            onDone(c);
          }}
        >
          Issue {naira(amount)}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {svc.giftCardPresets.map((v) => (
          <button key={v} aria-pressed={amount === v} onClick={() => setAmount(v)} className={cx("tnum h-10 rounded-lg border px-3 text-sm", amount === v ? "border-ink bg-ink text-white" : "border-line")}>
            {naira(v)}
          </button>
        ))}
      </div>
      <Field label="Amount" className="mt-4">
        <Input aria-label="Amount" prefix="₦" inputMode="numeric" className="tnum" value={amount ? amount.toLocaleString("en-NG") : ""} onChange={(e) => setAmount(money(e.target.value))} />
      </Field>
      <Field label="Customer (optional)" className="mt-4">
        {live ? (
          <>
            <Input aria-label="Search customer" value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} placeholder="Search name or phone" />
            {customerHits.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-line text-[13px]">
                {customerHits.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={cx("w-full px-3 py-2 text-left hover:bg-canvas", customerId === c.id && "bg-gold-soft")} onClick={() => (setCustomerId(c.id), setCustomerQ(c.name))}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {customerId && (
              <button type="button" className="mt-2 text-xs text-muted underline" onClick={() => (setCustomerId(""), setCustomerQ(""))}>
                Clear linked customer
              </button>
            )}
          </>
        ) : (
          <Select aria-label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Not linked</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Reason" className="mt-4">
        <Input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}
