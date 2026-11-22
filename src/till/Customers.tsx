import { useEffect, useMemo, useState } from "react";
import { Cake, CalendarClock, Sparkles, Heart, Mail, Phone, Ruler, Scissors, ShoppingBag, UserPlus, Users } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import { CLUB_PERKS } from "../data/seed";
import type { Customer, Product, SizeKind } from "../data/types";
import { naira } from "../lib/pricing";
import { Avatar, Button, ChannelBadge, Empty, SearchBox, Segmented, Select, StatusBadge, TierBadge, cx, fmtDate, toast } from "../ui/kit";
import { CustomerPicker } from "./Cart";
import { useRegister } from "./common";
import { ProductDialog, SIZE_LABEL, savedSize } from "./ProductDialog";
import { navigate } from "./Till";

export default function Customers() {
  const customers = useDb((s) => s.customers);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<"all" | "vip">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const live = liveMode();

  useEffect(() => {
    if (!live) return;
    const term = q.trim();
    if (term.length < 2) return;
    const timer = window.setTimeout(() => {
      posApi
        .searchCustomers(term)
        .then((rows) => {
          const local = useDb.getState().customers;
          const byId = new Map(local.map((c) => [c.id, c]));
          for (const c of rows) byId.set(c.id, { ...(byId.get(c.id) ?? (c as Customer)), ...(c as Customer) });
          useDb.setState({ customers: [...byId.values()] });
        })
        .catch((e) => toast(e instanceof ApiError ? e.message : "Could not search customers"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [live, q]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return customers.filter((c) => (tier === "all" || c.tier === "Gold" || c.tier === "Signature") && (!t || c.name.toLowerCase().includes(t) || c.phone.replace(/\s/g, "").includes(t.replace(/\s/g, "")) || c.email.includes(t)));
  }, [customers, q, tier]);
  const c = customers.find((x) => x.id === (sel ?? list[0]?.id));

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex max-h-[45%] min-h-0 flex-col border-b border-line bg-white md:max-h-none md:w-[360px] md:border-b-0 md:border-r">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Name, phone or email" className="flex-1" />
            <Button aria-label="New customer" onClick={() => setAdding(true)}>
              <UserPlus size={17} />
            </Button>
          </div>
          <Segmented size="sm" value={tier} onChange={setTier} options={[{ value: "all", label: `All (${customers.length})` }, { value: "vip", label: "Gold & Signature" }]} />
        </div>
        <ul className="thin-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {list.map((x) => (
            <li key={x.id}>
              <button onClick={() => setSel(x.id)} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", c?.id === x.id ? "bg-gold-soft" : "hover:bg-canvas")}>
                <Avatar name={x.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{x.name}</span>
                  <span className="tnum block text-xs text-muted">{x.phone}</span>
                </span>
                <TierBadge tier={x.tier} />
              </button>
            </li>
          ))}
          {!list.length && <Empty icon={<Users size={20} />} title="No customers found" />}
        </ul>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{c && <Profile c={c} />}</div>
      {adding && <CustomerPicker onClose={() => setAdding(false)} onPick={(x) => setSel(x.id)} />}
    </div>
  );
}

function Profile({ c }: { c: Customer }) {
  const all = useDb((s) => s.orders);
  const orders = useMemo(() => all.filter((o) => o.customerId === c.id), [all, c.id]);
  const l = useDb((s) => s.settings.loyalty);
  const next = { Standard: [l.minSpend.Silver, "Silver"], Silver: [l.minSpend.Gold, "Gold"], Gold: [l.minSpend.Signature, "Signature"], Signature: [0, ""] }[c.tier] as [number, string];
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={c.name} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <TierBadge tier={c.tier} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <Phone size={13} />
              {c.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={13} />
              {c.email}
            </span>
            {c.birthday && (
              <span className="flex items-center gap-1.5">
                <Cake size={13} />
                Birthday {c.birthday}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<ShoppingBag size={16} />}
          onClick={() => {
            useTill.getState().patchCart({ customerId: c.id, pointsToUse: 0 });
            navigate("sell");
          }}
        >
          Start a sale
        </Button>
      </div>
      {c.note && <p className="mt-4 rounded-lg bg-gold-soft px-4 py-3 text-[13px] text-gold-ink">{c.note}</p>}
      <div className="tnum mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Box label="ASL Club points" value={c.loyaltyPoints.toLocaleString()} sub={`Worth ${naira(c.loyaltyPoints * l.pointValue)}`} />
        <Box label="ASL Wallet" value={naira(c.walletBalance)} />
        <Box label="Lifetime spend" value={naira(c.spend)} sub={next[0] ? `${naira(Math.max(0, next[0] - c.spend))} to ${next[1]}` : "Top tier"} />
        <Box label="Orders" value={String(c.orders)} sub={`Member since ${fmtDate(c.joined)}`} />
      </div>
      {next[0] > 0 && (
        <div className="mt-3 h-2 rounded-full bg-canvas">
          <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.min(100, (c.spend / next[0]) * 100)}%` }} />
        </div>
      )}
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="text-[13px] font-semibold">ASL Club {c.tier} perks</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] text-ink-2 sm:grid-cols-2">
          {CLUB_PERKS[c.tier].map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />
              {p}
            </li>
          ))}
        </ul>
        {c.tags && c.tags.length > 0 && <p className="mt-3 text-xs text-muted">Interests: {c.tags.join(", ")}{c.city ? ` · ${c.city}` : ""}</p>}
      </div>
      <Clienteling c={c} />
      <h2 className="mb-3 mt-8 font-semibold">Orders in store and online</h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex -space-x-3">
              {o.lines.slice(0, 2).map((l, i) => (
                <img key={i} src={l.image} alt="" className="h-11 w-9 rounded-md border-2 border-white object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{o.number}</p>
              <p className="truncate text-xs text-muted">
                {fmtDate(o.createdAt)} · {o.lines.map((l) => l.name).join(", ")}
              </p>
            </div>
            <ChannelBadge channel={o.channel} />
            <StatusBadge status={o.status} />
            <span className="tnum w-24 text-right text-sm font-medium">{naira(o.total)}</span>
          </div>
        ))}
        {!orders.length && <p className="p-6 text-center text-sm text-muted">No orders yet.</p>}
      </div>
    </div>
  );
}

const KINDS: SizeKind[] = ["top", "bottom", "shoe"];
/** The website's size runs: clothing XS–XXL, jeans by waist, footwear in EU sizes. */
const OPTIONS: Record<SizeKind, string[]> = {
  top: ["XS", "S", "M", "L", "XL", "XXL"],
  bottom: ["28", "30", "32", "34", "36", "38"],
  shoe: ["39", "40", "41", "42", "43", "44", "45", "46"],
};

/** Sizes, app wishlist and open services: what a stylist needs before walking the floor with a client. */
function Clienteling({ c }: { c: Customer }) {
  const products = useDb((s) => s.products);
  const inventory = useDb((s) => s.inventory);
  const orders = useDb((s) => s.orders);
  const alterations = useDb((s) => s.alterations);
  const requests = useDb((s) => s.conciergeRequests);
  const patchCustomer = useDb((s) => s.patchCustomer);
  const { store } = useRegister();
  const [viewing, setViewing] = useState<Product | null>(null);
  const [editing, setEditing] = useState(false);
  const wish = useMemo(() => (c.wishlist ?? []).map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p), [c.wishlist, products]);
  const layaways = useMemo(() => orders.filter((o) => o.customerId === c.id && o.reservation?.status === "open"), [orders, c.id]);
  const alts = useMemo(() => alterations.filter((a) => a.customerId === c.id && a.status !== "collected"), [alterations, c.id]);
  const reqs = useMemo(() => requests.filter((r) => r.customerId === c.id && r.status !== "Delivered" && r.status !== "Cancelled"), [requests, c.id]);
  const open = () => {
    useTill.getState().patchCart({ customerId: c.id, pointsToUse: 0 });
  };

  return (
    <>
      {(layaways.length > 0 || alts.length > 0 || reqs.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {layaways.map((o) => (
            <button key={o.id} onClick={() => navigate("services")} className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-[13px] text-gold-ink">
              <CalendarClock size={15} />
              Reservation {o.number} · {naira(o.reservation!.balance)} to pay
            </button>
          ))}
          {alts.map((a) => (
            <button key={a.id} onClick={() => navigate("services")} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[13px]">
              <Scissors size={15} className="text-gold" />
              {a.number} · {a.status === "ready" ? "ready to collect" : `ready ${fmtDate(a.readyBy)}`}
            </button>
          ))}
          {reqs.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[13px]">
              <Sparkles size={15} className="text-gold" />
              {r.id} · {r.item} · {r.status}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Ruler size={16} />
              Sizes
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
          <div className="divide-y divide-line rounded-xl border border-line bg-white" data-testid="sizes">
            {KINDS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span className="text-muted">{SIZE_LABEL[k]}</span>
                {editing ? (
                  <Select aria-label={`${SIZE_LABEL[k]} size`} className="w-24" value={c.sizes?.[k] ?? ""} onChange={(e) => patchCustomer(c.id, { sizes: { ...c.sizes, [k]: e.target.value || undefined } })}>
                    <option value="">—</option>
                    {OPTIONS[k].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <span className="font-semibold">{c.sizes?.[k] ?? <span className="font-normal text-faint">Not saved</span>}</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Saved sizes are picked automatically when you open a product for {c.name.split(" ")[0]}, and they sync to the app.</p>
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Heart size={16} />
            Wishlist from the app
            <span className="font-normal text-muted">· {wish.length}</span>
          </h2>
          {wish.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {wish.map((p) => {
                const n = p.variants.reduce((a, v) => a + (inventory[v.id]?.[store.id] ?? 0), 0);
                const s = savedSize(p, c);
                const inSize = s ? p.variants.filter((v) => v.size === s).reduce((a, v) => a + (inventory[v.id]?.[store.id] ?? 0), 0) : n;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      open();
                      setViewing(p);
                    }}
                    className="overflow-hidden rounded-lg border border-line bg-white text-left hover:border-line-strong"
                    data-testid="wishlist-item"
                  >
                    <img src={p.image} alt="" className={cx("aspect-square w-full object-cover", n === 0 && "opacity-60 grayscale")} />
                    <span className="block px-2.5 py-2">
                      <span className="block truncate text-[12.5px] font-medium">{p.name}</span>
                      <span className="tnum block text-[11.5px] text-muted">{naira(p.price)}</span>
                      <span className={cx("block text-[11.5px]", inSize ? "text-good" : "text-faint")}>{s ? (inSize ? `Size ${s}: ${inSize} here` : `No size ${s} here`) : n ? `${n} here` : "Not in this store"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Nothing saved yet. Items they heart in the app show here.</p>
          )}
        </div>
      </div>
      {viewing && <ProductDialog product={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

