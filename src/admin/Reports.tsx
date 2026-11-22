import { ReactNode, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { findVariant, useDb } from "../data/store";
import { sameDay } from "../data/seed";
import type { Order, PayMethod } from "../data/types";
import { naira } from "../lib/pricing";
import { Avatar, Badge, Button, Card, Segmented, Select, Stat, cx, fmtDay, toast } from "../ui/kit";
import { Bars } from "../shared/charts";
import { METHOD } from "../shared/Receipt";
import { PageHead, Td, Th } from "./Admin";

type Tab = "products" | "categories" | "brands" | "sizes" | "staff" | "discounts" | "returns" | "payments";

const TABS: { value: Tab; label: string }[] = [
  { value: "products", label: "Products" },
  { value: "categories", label: "Categories" },
  { value: "brands", label: "Brands" },
  { value: "sizes", label: "Sizes" },
  { value: "staff", label: "Staff" },
  { value: "discounts", label: "Discounts" },
  { value: "returns", label: "Returns" },
  { value: "payments", label: "Payments" },
];

const METHODS: PayMethod[] = ["cash", "card", "transfer", "giftcard", "wallet"];

function group<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
}

type RankRowApi = { key: string; label: string; sub?: string; imageUrl?: string; net: number; units: number; orders: number };
type ReportsApi = {
  salesTotal: number;
  orderCount: number;
  discountTotal: number;
  refundTotal: number;
  byMethod: Record<string, number>;
  byDay: { date: string; total: number; count: number }[];
  salesCredit: { staffId: string; name: string; qty: number; net: number }[];
  byProduct: RankRowApi[];
  byCategory: RankRowApi[];
  byBrand: RankRowApi[];
  bySize: { size: string; sold: number; net: number }[];
  discounts: { label: string; kind: string; amount: number; uses: number }[];
  returns: { id: string; number: string; orderNumber: string; reason: string; amount: number; createdAt: string }[];
};

export default function Reports() {
  const orders = useDb((s) => s.orders);
  const products = useDb((s) => s.products);
  const stores = useDb((s) => s.stores);
  const staff = useDb((s) => s.staff);
  const settings = useDb((s) => s.settings);
  const inventory = useDb((s) => s.inventory);
  const live = liveMode();
  const [tab, setTab] = useState<Tab>("products");
  const [range, setRange] = useState("7");
  const [store, setStore] = useState("all");
  const [remote, setRemote] = useState<ReportsApi | null>(null);

  const since = range === "today" ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(range) * 86400e3;
  const inStore = (id?: string) => store === "all" || id === store;

  useEffect(() => {
    if (!live) return;
    const from = new Date(since).toISOString();
    const to = new Date().toISOString();
    adminPosApi
      .reports({ from, to, locationId: store === "all" ? undefined : store })
      .then((r) => {
        const raw = r as ReportsApi;
        const rank = (rows: RankRowApi[]) => rows.map((x) => ({ ...x, net: fromKobo(x.net) }));
        setRemote({
          ...raw,
          salesTotal: fromKobo(raw.salesTotal),
          discountTotal: fromKobo(raw.discountTotal ?? 0),
          refundTotal: fromKobo(raw.refundTotal ?? 0),
          byMethod: Object.fromEntries(Object.entries(raw.byMethod).map(([k, v]) => [k, fromKobo(v)])),
          byDay: raw.byDay.map((day) => ({ ...day, total: fromKobo(day.total) })),
          salesCredit: raw.salesCredit.map((s) => ({ ...s, net: fromKobo(s.net) })),
          byProduct: rank(raw.byProduct ?? []),
          byCategory: rank(raw.byCategory ?? []),
          byBrand: rank(raw.byBrand ?? []),
          bySize: (raw.bySize ?? []).map((s) => ({ ...s, net: fromKobo(s.net) })),
          discounts: (raw.discounts ?? []).map((d) => ({ ...d, amount: fromKobo(d.amount) })),
          returns: (raw.returns ?? []).map((ret) => ({ ...ret, amount: fromKobo(ret.amount) })),
        });
      })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not load reports"));
  }, [live, since, store]);

  const d = useMemo(() => {
    if (live && remote) {
      return { sales: [] as Order[], lines: [] as (Order["lines"][number] & { order: Order; seller: string; product?: { category: string } })[], sum: <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0), net: remote.salesTotal, returns: [] as (Order["returns"][number] & { order: Order })[], remote };
    }
    const sales = orders.filter((o) => o.channel === "pos" && o.status !== "cancelled" && inStore(o.storeId) && new Date(o.createdAt).getTime() >= since);
    const lines = sales.flatMap((o) => o.lines.map((l) => ({ ...l, order: o, product: products.find((p) => p.id === l.productId), seller: l.soldBy ?? o.staffId ?? "" })));
    const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
    const net = sum(sales, (o) => o.total);
    const returns = orders.flatMap((o) => o.returns.map((r) => ({ ...r, order: o }))).filter((r) => inStore(r.storeId) && new Date(r.createdAt).getTime() >= since);
    return { sales, lines, sum, net, returns };
  }, [orders, products, store, since, live, remote]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = live && remote ? remote.salesCredit.reduce((a, s) => a + s.qty, 0) : d.lines.reduce((a, l) => a + l.qty, 0);
  const discounts = live && remote ? remote.discountTotal : d.sales.reduce((a, o) => a + o.discountTotal, 0);
  const refunded = live && remote ? remote.refundTotal : (d.returns as { amount: number }[]).reduce((a, r) => a + r.amount, 0);
  const returnCount = live && remote ? remote.returns.length : d.returns.length;

  return (
    <>
      <PageHead
        title="Reports"
        sub="In-store sales broken down every way the floor team asks about. Numbers include sales made offline once they've synced."
        actions={
          <Button icon={<Download size={16} />} onClick={() => toast(`Exported the ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} report to CSV`)}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />
        <Select aria-label="Store" value={store} onChange={(e) => setStore(e.target.value)} className="w-auto">
          <option value="all">All stores</option>
          {stores
            .filter((s) => s.sellsInPerson)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net sales" value={naira(d.net)} sub={`${live && remote ? remote.orderCount : d.sales.length} sales`} />
        <Stat label="Units sold" value={units.toLocaleString()} sub={(live && remote ? remote.orderCount : d.sales.length) ? `${(units / (live && remote ? remote.orderCount : d.sales.length)).toFixed(1)} per sale` : undefined} />
        <Stat label="Discounts given" value={naira(discounts)} sub={!live && d.net ? `${((discounts / (d.net + discounts)) * 100).toFixed(1)}% of gross` : undefined} />
        <Stat label="Refunded" value={naira(refunded)} sub={`${returnCount} returns`} />
      </div>

      <div className="no-scrollbar mt-6 overflow-x-auto">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>
      <div className="mt-4">
        {tab === "products" && (live && remote ? <Ranked rows={apiRankToRows(remote.byProduct)} what="Product" /> : !live && <Ranked rows={rankBy(d.lines, (l) => l.productId, (ls) => ({ label: ls[0].name, sub: ls[0].brand, image: ls[0].image }))} what="Product" />)}
        {tab === "categories" && (live && remote ? <Ranked rows={apiRankToRows(remote.byCategory)} what="Category" /> : !live && <Ranked rows={rankBy(d.lines, (l) => l.product?.category ?? "Other", (ls) => ({ label: ls[0].product?.category ?? "Other" }))} what="Category" />)}
        {tab === "brands" && (live && remote ? <Ranked rows={apiRankToRows(remote.byBrand)} what="Brand" /> : !live && <Ranked rows={rankBy(d.lines, (l) => l.brand, (ls) => ({ label: ls[0].brand }))} what="Brand" />)}
        {tab === "sizes" && (live && remote ? <LiveSizes rows={remote.bySize} /> : !live && <Sizes lines={d.lines} stock={(vid) => Object.entries(inventory[vid] ?? {}).reduce((a, [sid, n]) => a + (inStore(sid) && sid !== "lag" ? n : 0), 0)} products={products} />)}
        {tab === "staff" && (live && remote ? <LiveStaffReport rows={remote.salesCredit} /> : <StaffReport lines={d.lines} orders={orders} staff={staff} settings={settings} store={store} />)}
        {tab === "discounts" && (live && remote ? <LiveDiscounts rows={remote.discounts} /> : <Discounts sales={d.sales} pointValue={settings.loyalty.pointValue} />)}
        {tab === "returns" && (live && remote ? <LiveReturns rows={remote.returns} /> : <Returns returns={d.returns} staff={staff} />)}
        {tab === "payments" && (live && remote ? <LivePayments byMethod={remote.byMethod} byDay={remote.byDay} /> : <Payments sales={d.sales} returns={d.returns} stores={stores.filter((s) => s.sellsInPerson && inStore(s.id))} />)}
        {live && !remote && (tab === "products" || tab === "categories" || tab === "brands" || tab === "sizes" || tab === "discounts" || tab === "returns") && <NoData />}
      </div>
    </>
  );
}

type Line = Order["lines"][number] & { order: Order; seller: string; product?: { category: string } };
type RankRow = { key: string; label: string; sub?: string; image?: string; net: number; units: number; orders: number };

function apiRankToRows(rows: RankRowApi[]): RankRow[] {
  return rows.map((r) => ({ key: r.key, label: r.label, sub: r.sub, image: r.imageUrl, net: r.net, units: r.units, orders: r.orders }));
}

function rankBy(lines: Line[], key: (l: Line) => string, meta: (ls: Line[]) => { label: string; sub?: string; image?: string }): RankRow[] {
  return [...group(lines, key).entries()]
    .map(([k, ls]) => ({ key: k, ...meta(ls), net: ls.reduce((a, l) => a + l.net, 0), units: ls.reduce((a, l) => a + l.qty, 0), orders: new Set(ls.map((l) => l.order.id)).size }))
    .sort((a, b) => b.net - a.net);
}

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
      <table className="tnum w-full text-[13px]">
        <thead className="border-b border-line bg-canvas/60">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function NoData() {
  return <p className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No sales in this period. Try a longer date range.</p>;
}

function Ranked({ rows, what }: { rows: RankRow[]; what: string }) {
  if (!rows.length) return <NoData />;
  const total = rows.reduce((a, r) => a + r.net, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title={`Top ${what.toLowerCase()}s by sales`}>
        <Bars data={rows.slice(0, 8).map((r) => ({ label: r.label, value: r.net, sub: `${r.units} sold` }))} />
      </Card>
      <Table
        head={
          <>
            <Th>{what}</Th>
            <Th right>Units</Th>
            <Th right>Sales</Th>
            <Th right>Share</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.key}>
            <Td>
              <span className="flex items-center gap-3">
                {r.image && <img src={r.image} alt="" className="h-10 w-8 rounded object-cover" />}
                <span>
                  <span className="block font-medium">{r.label}</span>
                  {r.sub && <span className="text-xs text-muted">{r.sub}</span>}
                </span>
              </span>
            </Td>
            <Td right>{r.units}</Td>
            <Td right className="font-medium">
              {naira(r.net)}
            </Td>
            <Td right className="text-muted">
              {((r.net / total) * 100).toFixed(1)}%
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Sizes({ lines, stock, products }: { lines: Line[]; stock: (variantId: string) => number; products: ReturnType<typeof useDb.getState>["products"] }) {
  const rows = useMemo(() => {
    const bySize = group(lines, (l) => findVariant(products, l.variantId)?.variant.size ?? "?");
    return [...bySize.entries()]
      .map(([size, ls]) => {
        const sold = ls.reduce((a, l) => a + l.qty, 0);
        const variants = new Set(products.flatMap((p) => p.variants.filter((v) => v.size === size).map((v) => v.id)));
        const left = [...variants].reduce((a, v) => a + stock(v), 0);
        return { size, sold, left, through: sold / Math.max(1, sold + left), net: ls.reduce((a, l) => a + l.net, 0) };
      })
      .sort((a, b) => b.sold - a.sold);
  }, [lines, products, stock]);
  if (!rows.length) return <NoData />;
  return (
    <>
      <p className="mb-3 text-[13px] text-muted">Sell-through is units sold as a share of units sold plus units still in the stores. A high number means that size is running out.</p>
      <Table
        head={
          <>
            <Th>Size</Th>
            <Th right>Sold</Th>
            <Th right>In stores now</Th>
            <Th>Sell-through</Th>
            <Th right>Sales</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.size}>
            <Td className="font-medium">{r.size}</Td>
            <Td right>{r.sold}</Td>
            <Td right>{r.left}</Td>
            <Td>
              <span className="flex items-center gap-2">
                <span className="h-2 w-28 rounded-full bg-canvas">
                  <span className={cx("block h-2 rounded-full", r.through > 0.5 ? "bg-bad" : "bg-gold")} style={{ width: `${r.through * 100}%` }} />
                </span>
                <span className={cx("text-xs", r.through > 0.5 ? "font-medium text-bad" : "text-muted")}>{(r.through * 100).toFixed(0)}%</span>
              </span>
            </Td>
            <Td right className="font-medium">
              {naira(r.net)}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function StaffReport({ lines, orders, staff, settings, store }: { lines: Line[]; orders: Order[]; staff: ReturnType<typeof useDb.getState>["staff"]; settings: ReturnType<typeof useDb.getState>["settings"]; store: string }) {
  const c = settings.commission;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const rows = useMemo(() => {
    const month = orders.filter((o) => o.channel === "pos" && o.status !== "cancelled" && new Date(o.createdAt).getTime() >= monthStart && (store === "all" || o.storeId === store)).flatMap((o) => o.lines.map((l) => ({ net: l.net, seller: l.soldBy ?? o.staffId ?? "" })));
    return staff
      .map((p) => {
        const mine = lines.filter((l) => l.seller === p.id);
        const net = mine.reduce((a, l) => a + l.net, 0);
        const sales = new Set(mine.map((l) => l.order.id)).size;
        const mtd = month.filter((l) => l.seller === p.id).reduce((a, l) => a + l.net, 0);
        return { p, net, units: mine.reduce((a, l) => a + l.qty, 0), sales, avg: sales ? net / sales : 0, commission: Math.round((net * (c.rates[p.role] ?? 0)) / 100), mtd, target: c.targets[p.id] ?? 0 };
      })
      .filter((r) => r.net > 0 || r.target > 0)
      .sort((a, b) => b.net - a.net);
  }, [lines, orders, staff, c, store, monthStart]);
  if (!rows.length) return <NoData />;
  return (
    <>
      {!c.enabled && <p className="mb-3 rounded-lg bg-warn-soft p-3 text-[13px] text-warn">Commission tracking is off in POS → Commission. Sales credit is still shown.</p>}
      <Table
        head={
          <>
            <Th>Sales associate</Th>
            <Th right>Sales</Th>
            <Th right>Units</Th>
            <Th right>Avg basket</Th>
            <Th right>Commission</Th>
            <Th>This month vs target</Th>
          </>
        }
      >
        {rows.map((r) => {
          const pct = r.target ? Math.min(1, r.mtd / r.target) : 0;
          return (
            <tr key={r.p.id}>
              <Td>
                <span className="flex items-center gap-3">
                  <Avatar name={r.p.name} size={32} />
                  <span>
                    <span className="block font-medium">{r.p.name}</span>
                    <span className="text-xs text-muted">
                      {r.p.role} · {c.rates[r.p.role] ?? 0}%
                    </span>
                  </span>
                </span>
              </Td>
              <Td right className="font-medium">
                {naira(r.net)}
              </Td>
              <Td right>{r.units}</Td>
              <Td right>{naira(r.avg)}</Td>
              <Td right className="font-medium text-gold-ink">
                {naira(r.commission)}
              </Td>
              <Td>
                {r.target ? (
                  <span className="block min-w-[170px]">
                    <span className="flex justify-between text-xs text-muted">
                      <span>{naira(r.mtd)}</span>
                      <span>{(pct * 100).toFixed(0)}% of {naira(r.target)}</span>
                    </span>
                    <span className="mt-1 block h-2 rounded-full bg-canvas">
                      <span className={cx("block h-2 rounded-full", pct >= 1 ? "bg-good" : "bg-gold")} style={{ width: `${pct * 100}%` }} />
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-faint">No target</span>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-2 text-xs text-muted">Sales are credited to the associate picked at the till for each item, after discounts. Commission is for the date range above; targets are for the calendar month.</p>
    </>
  );
}

function Discounts({ sales, pointValue }: { sales: Order[]; pointValue: number }) {
  const rows = useMemo(() => {
    const m = new Map<string, { label: string; kind: string; amount: number; uses: number }>();
    const add = (key: string, label: string, kind: string, amount: number) => {
      if (amount <= 0) return;
      const r = m.get(key) ?? { label, kind, amount: 0, uses: 0 };
      m.set(key, { ...r, amount: r.amount + amount, uses: r.uses + 1 });
    };
    for (const o of sales) {
      for (const p of o.promos ?? []) add(`promo-${p.id}`, p.label, "Automatic promotion", p.amount);
      const item = o.lines.reduce((a, l) => a + l.lineDiscount - (l.promo ?? 0), 0);
      add("item", "Item discounts", "Staff discount", item);
      if (o.couponCode) add(`coupon-${o.couponCode}`, o.couponCode, "Promo code", o.couponAmount ?? 0);
      if (o.manualDiscount) add(`manual-${o.manualDiscount.reason}`, o.manualDiscount.reason, "Staff discount", o.manualDiscount.amount);
      add("points", "ASL Club points", "Loyalty", o.pointsRedeemed * pointValue);
    }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [sales, pointValue]);
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No discounts given in this period.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title="Where the discounts went">
        <Bars data={rows.slice(0, 8).map((r) => ({ label: r.label, value: r.amount, sub: `${r.uses}×` }))} />
      </Card>
      <Table
        head={
          <>
            <Th>Discount</Th>
            <Th>Type</Th>
            <Th right>Sales</Th>
            <Th right>Given</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.kind + r.label}>
            <Td className="font-medium">{r.label}</Td>
            <Td>
              <Badge tone={r.kind === "Automatic promotion" ? "gold" : r.kind === "Staff discount" ? "warn" : "neutral"}>{r.kind}</Badge>
            </Td>
            <Td right>{r.uses}</Td>
            <Td right className="font-medium">
              {naira(r.amount)}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Returns({ returns, staff }: { returns: (Order["returns"][number] & { order: Order })[]; staff: ReturnType<typeof useDb.getState>["staff"] }) {
  if (!returns.length) return <p className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No returns in this period.</p>;
  const reasons = [...group(returns, (r) => r.reason).entries()].map(([label, rs]) => ({ label, value: rs.reduce((a, r) => a + r.amount, 0), sub: `${rs.length}×` })).sort((a, b) => b.value - a.value);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title="By reason">
        <Bars data={reasons} />
      </Card>
      <Table
        head={
          <>
            <Th>Slip</Th>
            <Th>Reason</Th>
            <Th>By</Th>
            <Th right>Amount</Th>
          </>
        }
      >
        {returns.map((r) => (
          <tr key={r.id}>
            <Td>
              <span className="block font-medium">{r.number}</span>
              <span className="text-xs text-muted">
                {r.order.number} · {fmtDay(r.createdAt)}
              </span>
            </Td>
            <Td>
              {r.reason} {r.kind === "exchange" && <Badge>Exchange</Badge>}
            </Td>
            <Td>
              {staff.find((s) => s.id === r.staffId)?.name.split(" ")[0]}
              {r.approvedBy && <span className="block text-xs text-muted">Approved by {staff.find((s) => s.id === r.approvedBy)?.name.split(" ")[0]}</span>}
            </Td>
            <Td right className="font-medium">
              {naira(r.amount)}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function LiveSizes({ rows }: { rows: ReportsApi["bySize"] }) {
  if (!rows.length) return <NoData />;
  return (
    <Table
      head={
        <>
          <Th>Size</Th>
          <Th right>Sold</Th>
          <Th right>Sales</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.size}>
          <Td className="font-medium">{r.size}</Td>
          <Td right>{r.sold}</Td>
          <Td right className="font-medium">
            {naira(r.net)}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

function LiveDiscounts({ rows }: { rows: ReportsApi["discounts"] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No discounts given in this period.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title="Where the discounts went">
        <Bars data={rows.slice(0, 8).map((r) => ({ label: r.label, value: r.amount, sub: `${r.uses}×` }))} />
      </Card>
      <Table
        head={
          <>
            <Th>Discount</Th>
            <Th>Type</Th>
            <Th right>Sales</Th>
            <Th right>Given</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.kind + r.label}>
            <Td className="font-medium">{r.label}</Td>
            <Td>
              <Badge tone={r.kind === "Automatic promotion" ? "gold" : r.kind === "Staff discount" ? "warn" : "neutral"}>{r.kind}</Badge>
            </Td>
            <Td right>{r.uses}</Td>
            <Td right className="font-medium">
              {naira(r.amount)}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function LiveReturns({ rows }: { rows: ReportsApi["returns"] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No returns in this period.</p>;
  const reasons = [...group(rows, (r) => r.reason).entries()].map(([label, rs]) => ({ label, value: rs.reduce((a, r) => a + r.amount, 0), sub: `${rs.length}×` })).sort((a, b) => b.value - a.value);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card title="By reason">
        <Bars data={reasons} />
      </Card>
      <Table
        head={
          <>
            <Th>Slip</Th>
            <Th>Reason</Th>
            <Th right>Amount</Th>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>
              <span className="block font-medium">{r.number}</span>
              <span className="text-xs text-muted">
                {r.orderNumber} · {fmtDay(r.createdAt)}
              </span>
            </Td>
            <Td>{r.reason}</Td>
            <Td right className="font-medium">
              {naira(r.amount)}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function LiveStaffReport({ rows }: { rows: ReportsApi["salesCredit"] }) {
  if (!rows.length) return <NoData />;
  return (
    <Table
      head={
        <>
          <Th>Sales associate</Th>
          <Th right>Units</Th>
          <Th right>Net sales</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.staffId}>
          <Td className="font-medium">{r.name}</Td>
          <Td right>{r.qty}</Td>
          <Td right className="font-medium">
            {naira(r.net)}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

function LivePayments({ byMethod, byDay }: { byMethod: Record<string, number>; byDay: ReportsApi["byDay"] }) {
  if (!byDay.length && !Object.keys(byMethod).length) return <NoData />;
  return (
    <>
      <Card title="By payment method" pad={false}>
        <div className="overflow-x-auto">
          <table className="tnum w-full text-[13px]">
            <tbody className="divide-y divide-line">
              {Object.entries(byMethod).map(([m, v]) => (
                <tr key={m}>
                  <Td className="font-medium">{METHOD[m as PayMethod] ?? m}</Td>
                  <Td right className="font-semibold">
                    {naira(v)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <h2 className="mb-2 mt-6 text-[15px] font-semibold">Daily sales</h2>
      <Table
        head={
          <>
            <Th>Day</Th>
            <Th right>Sales</Th>
            <Th right>Orders</Th>
          </>
        }
      >
        {byDay.map((d) => (
          <tr key={d.date}>
            <Td className="font-medium">{fmtDay(d.date)}</Td>
            <Td right className="font-medium">
              {naira(d.total)}
            </Td>
            <Td right>{d.count}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Payments({ sales, returns, stores }: { sales: Order[]; returns: (Order["returns"][number] & { order: Order })[]; stores: ReturnType<typeof useDb.getState>["stores"] }) {
  const byMethod = (os: Order[], m: PayMethod) => os.flatMap((o) => o.payments).filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
  const days = useMemo(() => {
    const keys = [...new Set(sales.map((o) => new Date(o.createdAt).toDateString()))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return keys.map((k) => {
      const os = sales.filter((o) => sameDay(o.createdAt, k));
      const out = returns.filter((r) => sameDay(r.createdAt, k)).flatMap((r) => r.refunds).reduce((a, p) => a + p.amount, 0);
      return { day: new Date(k).toISOString(), os, out };
    });
  }, [sales, returns]);
  if (!sales.length) return <NoData />;
  return (
    <>
      <Card title="By store and method" pad={false}>
        <div className="overflow-x-auto">
          <table className="tnum w-full text-[13px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Store</Th>
                {METHODS.map((m) => (
                  <Th key={m} right>
                    {METHOD[m] ?? "Gift card"}
                  </Th>
                ))}
                <Th right>Total taken</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stores.map((s) => {
                const os = sales.filter((o) => o.storeId === s.id);
                return (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    {METHODS.map((m) => (
                      <Td key={m} right>
                        {naira(byMethod(os, m))}
                      </Td>
                    ))}
                    <Td right className="font-semibold">
                      {naira(os.flatMap((o) => o.payments).reduce((a, p) => a + p.amount, 0))}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <h2 className="mb-2 mt-6 text-[15px] font-semibold">Daily reconciliation</h2>
      <p className="mb-3 text-[13px] text-muted">Match each column against the bank statement, card terminal settlement and cash banked for that day.</p>
      <Table
        head={
          <>
            <Th>Day</Th>
            {METHODS.map((m) => (
              <Th key={m} right>
                {METHOD[m] ?? "Gift card"}
              </Th>
            ))}
            <Th right>Refunds out</Th>
            <Th right>Net</Th>
          </>
        }
      >
        {days.map((d) => {
          const taken = d.os.flatMap((o) => o.payments).reduce((a, p) => a + p.amount, 0);
          return (
            <tr key={d.day}>
              <Td className="font-medium">{fmtDay(d.day)}</Td>
              {METHODS.map((m) => (
                <Td key={m} right>
                  {byMethod(d.os, m) ? naira(byMethod(d.os, m)) : <span className="text-faint">–</span>}
                </Td>
              ))}
              <Td right className="text-bad">
                {d.out ? naira(-d.out) : <span className="text-faint">–</span>}
              </Td>
              <Td right className="font-semibold">
                {naira(taken - d.out)}
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
