import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MonitorSmartphone, PackageCheck, RefreshCw, ShoppingBag, Store, Tag, Truck } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { useDb } from "../data/store";
import { sameDay } from "../data/seed";
import { naira } from "../lib/pricing";
import { Avatar, Badge, Button, Card, Stat, timeAgo, toast } from "../ui/kit";
import { Bars, Columns } from "../shared/charts";
import { PageHead } from "./Admin";

type OverviewApi = {
  today: { sales: number; salesYesterday: number; count: number; countYesterday: number; avg: number; returns: number; returnCount: number };
  byHour: { hour: number; total: number; count: number }[];
  byStore: { locationId: string; name: string; total: number; count: number }[];
  byStaff: { staffId: string; name: string; role: string; total: number; count: number }[];
  registers: {
    id: string;
    name: string;
    locationId: string;
    locationName: string | null;
    online: boolean;
    lastSeenAt: string | null;
    salesToday: number;
    session: { openedById: string } | null;
  }[];
  attention: { layawaysDueSoon: number; pendingTransfers: number; alterationsReady: number; giftCardLiability: number };
};

export default function Overview() {
  const db = useDb();
  const live = liveMode();
  const [remote, setRemote] = useState<OverviewApi | null>(null);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400e3);
  const pos = db.orders.filter((o) => o.channel === "pos" && o.synced);

  useEffect(() => {
    if (!live) return;
    adminPosApi
      .overview()
      .then((o) => setRemote(o as OverviewApi))
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load overview"));
  }, [live]);

  const s = useMemo(() => {
    if (live && remote) {
      const hours = remote.byHour;
      return {
        sales: fromKobo(remote.today.sales),
        salesY: fromKobo(remote.today.salesYesterday),
        count: remote.today.count,
        countY: remote.today.countYesterday,
        avg: fromKobo(remote.today.avg),
        avgY: remote.today.countYesterday ? fromKobo(remote.today.salesYesterday) / remote.today.countYesterday : 0,
        returns: fromKobo(remote.today.returns),
        returnCount: remote.today.returnCount,
        byHour: hours.map((h) => ({
          label: `${h.hour % 12 || 12}${h.hour < 12 ? "a" : "p"}`,
          hint: `${h.hour % 12 || 12}${h.hour < 12 ? "am" : "pm"}`,
          value: fromKobo(h.total),
        })),
        byStore: remote.byStore.map((st) => ({ label: st.name, value: fromKobo(st.total), sub: `${st.count} sales` })),
        byStaff: remote.byStaff.map((p) => ({ label: p.name, value: fromKobo(p.total), sub: p.role })),
        online: [] as typeof db.orders,
        pickups: [] as typeof db.orders,
      };
    }
    const t = pos.filter((o) => sameDay(o.createdAt, today));
    const y = pos.filter((o) => sameDay(o.createdAt, yesterday));
    const sum = (xs: typeof pos) => xs.reduce((a, o) => a + o.total, 0);
    const returns = db.orders.flatMap((o) => o.returns).filter((r) => sameDay(r.createdAt, today));
    const hours = Array.from({ length: 12 }, (_, i) => i + 9);
    return {
      sales: sum(t),
      salesY: sum(y),
      count: t.length,
      countY: y.length,
      avg: t.length ? sum(t) / t.length : 0,
      avgY: y.length ? sum(y) / y.length : 0,
      returns: returns.reduce((a, r) => a + r.amount, 0),
      returnCount: returns.length,
      byHour: hours.map((h) => ({ label: `${h % 12 || 12}${h < 12 ? "a" : "p"}`, hint: `${h % 12 || 12}${h < 12 ? "am" : "pm"}`, value: sum(t.filter((o) => new Date(o.createdAt).getHours() === h)) })),
      byStore: db.stores.filter((x) => x.sellsInPerson).map((st) => ({ label: st.name, value: sum(t.filter((o) => o.storeId === st.id)), sub: `${t.filter((o) => o.storeId === st.id).length} sales` })),
      byStaff: db.staff
        .map((p) => ({ label: p.name, value: sum(t.filter((o) => o.staffId === p.id)), sub: p.role }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value),
      online: db.orders.filter((o) => o.channel !== "pos" && sameDay(o.createdAt, today)),
      pickups: db.orders.filter((o) => o.fulfilment === "pickup" && (o.status === "ready" || o.status === "processing")),
    };
  }, [db.orders, db.stores, db.staff, live, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : NaN);
  const unsynced = db.orders.filter((o) => !o.synced).length;

  return (
    <>
      <PageHead
        title="Overview"
        sub="In-store sales across every till, live. Online orders and pickups waiting in stores are shown alongside."
        actions={
          <a href="#till" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2">
            <MonitorSmartphone size={17} />
            Open the till
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In-store sales today" value={naira(s.sales)} delta={pct(s.sales, s.salesY)} sub="vs yesterday" />
        <Stat label="Transactions" value={s.count} delta={pct(s.count, s.countY)} sub="vs yesterday" />
        <Stat label="Average basket" value={naira(s.avg)} delta={pct(s.avg, s.avgY)} sub="vs yesterday" />
        <Stat label="Returns today" value={naira(s.returns)} sub={`${s.returnCount} ${s.returnCount === 1 ? "return" : "returns"}`} />
      </div>

      <Attention live={live} attention={remote?.attention} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Sales by hour" action={<span className="text-xs text-muted">All stores · today</span>}>
          <Columns data={s.byHour} testId="admin-hourly" />
        </Card>
        <Card title="By store">
          <Bars data={s.byStore} />
          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-3 text-[13px] font-medium">Top staff today</p>
            {s.byStaff.length ? <Bars data={s.byStaff.slice(0, 4)} /> : <p className="text-sm text-muted">No sales yet today.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Registers" pad={false} action={<a href="#pos-registers" className="text-[13px] font-medium text-gold-ink hover:underline">Manage</a>}>
          <ul className="divide-y divide-line">
            {(live && remote
              ? remote.registers.map((r) => ({
                  id: r.id,
                  online: r.online,
                  storeName: r.locationName ?? r.locationId,
                  name: r.name,
                  sub: r.online ? (r.session ? "Open" : "Online · register closed") : `Offline · last seen ${r.lastSeenAt ? timeAgo(r.lastSeenAt) : "—"}`,
                  pending: 0,
                  todaySales: fromKobo(r.salesToday),
                }))
              : db.registers.map((r) => {
                  const store = db.stores.find((x) => x.id === r.storeId)!;
                  const open = db.sessions.find((x) => x.registerId === r.id && !x.closedAt);
                  const who = open && db.staff.find((p) => p.id === open.openedBy);
                  const pending = db.orders.filter((o) => o.registerId === r.id && !o.synced).length;
                  const todaySales = pos.filter((o) => o.registerId === r.id && sameDay(o.createdAt, today)).reduce((a, o) => a + o.total, 0);
                  return {
                    id: r.id,
                    online: r.online,
                    storeName: store.name,
                    name: r.name,
                    sub: r.online ? (who ? `Open · ${who.name}` : "Online · register closed") : `Offline · last seen ${timeAgo(r.lastSeen)}`,
                    pending,
                    todaySales,
                  };
                })
            ).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5" data-testid={`register-${r.id}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${r.online ? "bg-good" : "bg-faint"}`} />
                <div className="min-w-[150px] flex-1">
                  <p className="font-medium">
                    {r.storeName} · {r.name}
                  </p>
                  <p className="text-[13px] text-muted">{r.sub}</p>
                </div>
                {r.pending > 0 && <Badge tone="warn">{r.pending} waiting to sync</Badge>}
                <span className="tnum w-28 text-right font-medium">{naira(r.todaySales)}</span>
              </li>
            ))}
          </ul>
          {!live && unsynced > 0 && <p className="border-t border-line bg-warn-soft px-5 py-2.5 text-[13px] text-warn">{unsynced} till sales are saved on an offline device and will appear here when it reconnects.</p>}
        </Card>

        <Card title="Online orders for in-store pickup" pad={false}>
          <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
            <div className="px-5 py-3">
              <p className="text-[13px] text-muted">Website and app today</p>
              <p className="tnum text-xl font-semibold">{s.online.length}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-[13px] text-muted">Waiting in stores</p>
              <p className="tnum text-xl font-semibold">{s.pickups.length}</p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {s.pickups.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                <PackageCheck size={16} className={o.status === "ready" ? "text-info" : "text-warn"} />
                <span className="font-medium">{o.number}</span>
                <span className="truncate text-muted">{db.stores.find((x) => x.id === o.pickupStoreId)?.name}</span>
                <Badge tone={o.status === "ready" ? "info" : "warn"} className="ml-auto">
                  {o.status === "ready" ? "Ready" : "To pack"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Activity" pad={false}>
          <ul className="divide-y divide-line" data-testid="activity">
            {db.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-muted">
                  {a.kind === "online" ? <Truck size={14} /> : a.kind === "sync" ? <RefreshCw size={14} /> : a.kind === "sale" ? <ShoppingBag size={14} /> : a.kind === "settings" ? <Tag size={14} /> : <Store size={14} />}
                </span>
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="shrink-0 text-xs text-faint">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {!live && (
          <Card title="Try the connection">
            <p className="text-[13px] text-muted">The prototype's admin and tills share one set of data. Open the till in another tab, then use these to see changes arrive.</p>
            <div className="mt-4 space-y-2">
              <Button
                className="w-full justify-between"
                onClick={() => {
                  const o = db.simulateOnlineOrder("LOC-1001");
                  toast(`${o.number} placed online for pickup at Ikoyi`);
                }}
              >
                Place a website order for Ikoyi pickup
                <ArrowRight size={16} />
              </Button>
              <Button
                className="w-full justify-between"
                onClick={() => {
                  const p = db.products.find((x) => x.id === "p5")!;
                  const next = p.price === 96000 ? 79000 : 96000;
                  db.patchProduct(p.id, { price: next, compareAt: next < 96000 ? 96000 : undefined });
                  db.log(`Price of ${p.name} changed to ${naira(next)} in Products`, "settings");
                  toast(`${p.name} is now ${naira(next)} on every till`);
                }}
              >
                Put the Knit Poncho on sale (or back)
                <ArrowRight size={16} />
              </Button>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-lg bg-canvas p-3">
              <Avatar name="Temi Bakare" size={30} />
              <p className="text-[12.5px] text-muted">Sample PINs for the till: Temi 1234 (manager), Chidi 2468 (supervisor), Halima 1111 (cashier).</p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/** Things waiting on a manager, each linking to where it's handled. */
function Attention({ live, attention }: { live: boolean; attention?: OverviewApi["attention"] }) {
  const transfers = useDb((s) => s.transfers);
  const orders = useDb((s) => s.orders);
  const alterations = useDb((s) => s.alterations);
  const giftCards = useDb((s) => s.giftCards);
  const items = useMemo(() => {
    if (live && attention) {
      return [
        { n: attention.pendingTransfers, label: "transfers to approve", href: "#pos-stock" },
        { n: attention.layawaysDueSoon, label: "reservations due within 3 days", href: "#pos-transactions" },
        { n: attention.alterationsReady, label: "alterations ready to collect", href: "#pos-services" },
        { n: fromKobo(attention.giftCardLiability), label: "owed on gift cards", href: "#pos-giftcards", money: true },
      ];
    }
    const soon = Date.now() + 3 * 86400e3;
    return [
      { n: transfers.filter((t) => t.status === "requested").length, label: "transfers to approve", href: "#pos-stock" },
      { n: orders.filter((o) => o.reservation?.status === "open" && new Date(o.reservation.until).getTime() < soon).length, label: "reservations due within 3 days", href: "#pos-transactions" },
      { n: alterations.filter((a) => a.status === "ready").length, label: "alterations ready to collect", href: "#pos-services" },
      { n: giftCards.filter((g) => g.status === "active").reduce((a, g) => a + g.balance, 0), label: "owed on gift cards", href: "#pos-giftcards", money: true },
    ];
  }, [transfers, orders, alterations, giftCards, live, attention]);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <a key={i.label} href={i.href} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-[13px] shadow-card hover:border-line-strong">
          <span className={i.n && !i.money ? "tnum flex h-8 min-w-8 items-center justify-center rounded-full bg-gold px-2 text-sm font-semibold text-white" : "tnum text-sm font-semibold"}>{i.money ? naira(i.n) : i.n}</span>
          <span className="flex-1 text-ink-2">{i.label}</span>
          <ArrowRight size={14} className="text-faint" />
        </a>
      ))}
    </div>
  );
}
