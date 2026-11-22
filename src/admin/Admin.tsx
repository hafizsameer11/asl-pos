import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Bell,
  BellRing,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  Cpu,
  Crown,
  FileText,
  Flag,
  FolderTree,
  Gauge,
  Gift,
  GitBranch,
  HandCoins,
  HelpCircle,
  Image as ImageIcon,
  Kanban,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  Newspaper,
  Package,
  PackageCheck,
  Palette,
  PenSquare,
  Percent,
  PieChart,
  Receipt,
  ReceiptText,
  RotateCcw,
  Route as RouteIcon,
  Scissors,
  ScrollText,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Truck,
  Undo2,
  UserCog,
  Users,
  Users2,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import type { Staff } from "../data/types";
import { Toaster, cx } from "../ui/kit";
import Overview from "./Overview";
import Transactions from "./Transactions";
import Registers from "./Registers";
import Stores from "./Stores";
import StaffPage from "./Staff";
import { CashPage, CheckoutPage, HardwarePage, LoyaltyPage, OfflinePage, PaymentsPage, ReceiptsPage, ReturnsPage } from "./SettingsPages";
import { CommissionPage, ServicesPage } from "./ServicesSettings";
import Reports from "./Reports";
import AuditLog from "./AuditLog";
import Promotions from "./Promotions";
import GiftCards from "./GiftCards";
import StockMoves from "./StockMoves";
import { AdminUserChip } from "./AdminGate";

/**
 * The existing ASL ORIGINALS admin menu, copied from the admin prototype (components/admin/nav-config.ts):
 * same groups, labels, order and routes. The prototype only stands in for these pages.
 * The new POS group goes straight after Sales: see docs/INTEGRATION.md for the nav-config entry.
 */
const EXISTING: { id: string; label: string; items: { id: string; label: string; to: string; icon: typeof Gauge; badge?: number }[] }[] = [
  { id: "overview", label: "Overview", items: [
    { id: "dashboard", label: "Dashboard", to: "/admin", icon: LayoutDashboard },
    { id: "activity", label: "Live Activity", to: "/admin/activity", icon: Activity },
  ] },
  { id: "sales", label: "Sales", items: [
    { id: "orders", label: "Orders", to: "/admin/orders", icon: ShoppingBag, badge: 12 },
    { id: "drafts", label: "Draft Orders", to: "/admin/drafts", icon: FileText },
    { id: "carts", label: "Abandoned Carts", to: "/admin/carts", icon: ShoppingCart },
    { id: "returns", label: "Returns & Refunds", to: "/admin/returns", icon: Undo2 },
    { id: "transactions", label: "Transactions", to: "/admin/transactions", icon: Receipt },
  ] },
  { id: "concierge", label: "Concierge", items: [
    { id: "inbox", label: "Requests Inbox", to: "/admin/concierge/inbox", icon: Sparkles, badge: 4 },
    { id: "board", label: "Sourcing Board", to: "/admin/concierge/board", icon: Kanban },
    { id: "quotes", label: "Quotes", to: "/admin/concierge/quotes", icon: FileText },
    { id: "suppliers", label: "Suppliers", to: "/admin/concierge/suppliers", icon: Truck },
    { id: "chat", label: "Concierge Chat", to: "/admin/concierge/chat", icon: MessageSquare },
  ] },
  { id: "catalog", label: "Catalog", items: [
    { id: "products", label: "Products", to: "/admin/products", icon: Package },
    { id: "collections", label: "Collections", to: "/admin/collections", icon: Layers },
    { id: "categories", label: "Categories", to: "/admin/categories", icon: FolderTree },
    { id: "brands", label: "Brands", to: "/admin/brands", icon: Tag },
    { id: "size-guides", label: "Size Guides", to: "/admin/size-guides", icon: ScrollText },
    { id: "inventory", label: "Inventory", to: "/admin/inventory", icon: Boxes },
    { id: "media", label: "Media Library", to: "/admin/media", icon: ImageIcon },
    { id: "reviews", label: "Reviews", to: "/admin/reviews", icon: Star },
  ] },
  { id: "customers", label: "Customers", items: [
    { id: "customers", label: "All Customers", to: "/admin/customers", icon: Users },
    { id: "segments", label: "Segments", to: "/admin/segments", icon: Users2 },
    { id: "club", label: "ASL Club", to: "/admin/club", icon: Crown },
    { id: "wallets", label: "Wallets & Credits", to: "/admin/wallets", icon: Wallet },
    { id: "addresses", label: "Addresses", to: "/admin/addresses", icon: MapPin },
  ] },
  { id: "marketing", label: "Marketing", items: [
    { id: "campaigns", label: "Campaigns", to: "/admin/campaigns", icon: Megaphone },
    { id: "coupons", label: "Coupons", to: "/admin/coupons", icon: Ticket },
    { id: "slots", label: "Homepage Slots", to: "/admin/slots", icon: Palette },
    { id: "banners", label: "Banners", to: "/admin/banners", icon: Flag },
    { id: "messaging", label: "Push & Email", to: "/admin/messaging", icon: Bell },
    { id: "referrals", label: "Referrals", to: "/admin/referrals", icon: Share2 },
    { id: "seo", label: "SEO", to: "/admin/seo", icon: Search },
  ] },
  { id: "content", label: "Content", items: [
    { id: "pages", label: "Pages", to: "/admin/pages", icon: Newspaper },
    { id: "faqs", label: "FAQs", to: "/admin/faqs", icon: HelpCircle },
    { id: "announcement", label: "Announcement Bar", to: "/admin/announcement", icon: Megaphone },
    { id: "blog", label: "Blog", to: "/admin/blog", icon: PenSquare },
  ] },
  { id: "fulfilment", label: "Fulfilment", items: [
    { id: "shipments", label: "Shipments", to: "/admin/shipments", icon: Truck },
    { id: "shipping-zones", label: "Shipping Zones", to: "/admin/shipping-zones", icon: RouteIcon },
    { id: "pickups", label: "Pickups", to: "/admin/pickups", icon: PackageCheck },
  ] },
  { id: "finance", label: "Finance", items: [
    { id: "payouts", label: "Payouts", to: "/admin/payouts", icon: Landmark },
    { id: "tax", label: "Tax", to: "/admin/tax", icon: Percent },
    { id: "reports", label: "Reports", to: "/admin/reports", icon: BarChart3 },
    { id: "ledger", label: "Ledger", to: "/admin/ledger", icon: ScrollText },
  ] },
  { id: "analytics", label: "Analytics", items: [
    { id: "sales-a", label: "Sales", to: "/admin/analytics/sales", icon: LineChart },
    { id: "traffic-a", label: "Traffic", to: "/admin/analytics/traffic", icon: BarChart3 },
    { id: "products-a", label: "Products", to: "/admin/analytics/products", icon: PieChart },
    { id: "concierge-a", label: "Concierge", to: "/admin/analytics/concierge", icon: LineChart },
    { id: "cohorts", label: "Cohorts", to: "/admin/analytics/cohorts", icon: GitBranch },
  ] },
  { id: "support", label: "Support", items: [{ id: "tickets", label: "Tickets", to: "/admin/tickets", icon: LifeBuoy }] },
  { id: "system", label: "System", items: [
    { id: "team", label: "Team & Roles", to: "/admin/team", icon: ShieldCheck },
    { id: "audit", label: "Audit Log", to: "/admin/audit", icon: ScrollText },
    { id: "settings", label: "Store Settings", to: "/admin/settings", icon: Settings },
    { id: "notifications", label: "Notifications", to: "/admin/notification-settings", icon: BellRing },
  ] },
];
const EXISTING_ITEMS = EXISTING.flatMap((g) => g.items);

export const POS_PAGES: { id: string; label: string; icon: typeof Gauge; group: string; render: () => ReactNode }[] = [
  { id: "overview", label: "Overview", icon: Gauge, group: "Operate", render: () => <Overview /> },
  { id: "transactions", label: "Transactions", icon: ReceiptText, group: "Operate", render: () => <Transactions /> },
  { id: "reports", label: "Reports", icon: BarChart3, group: "Operate", render: () => <Reports /> },
  { id: "registers", label: "Registers & sessions", icon: MonitorSmartphone, group: "Operate", render: () => <Registers /> },
  { id: "stock", label: "Stock movements", icon: ArrowLeftRight, group: "Operate", render: () => <StockMoves /> },
  { id: "audit", label: "Audit log", icon: ShieldCheck, group: "Operate", render: () => <AuditLog /> },
  { id: "promotions", label: "Automatic promotions", icon: Sparkles, group: "Selling", render: () => <Promotions /> },
  { id: "giftcards", label: "Gift cards", icon: Gift, group: "Selling", render: () => <GiftCards /> },
  { id: "stores", label: "Stores", icon: Building2, group: "Set up", render: () => <Stores /> },
  { id: "staff", label: "Staff & roles", icon: UserCog, group: "Set up", render: () => <StaffPage /> },
  { id: "payments", label: "Payment methods", icon: Wallet, group: "Set up", render: () => <PaymentsPage /> },
  { id: "checkout", label: "Checkout & discounts", icon: BadgePercent, group: "Set up", render: () => <CheckoutPage /> },
  { id: "receipts", label: "Receipts", icon: FileText, group: "Set up", render: () => <ReceiptsPage /> },
  { id: "returns", label: "Returns & exchanges", icon: RotateCcw, group: "Set up", render: () => <ReturnsPage /> },
  { id: "cash", label: "Cash management", icon: HandCoins, group: "Set up", render: () => <CashPage /> },
  { id: "loyalty", label: "Loyalty at the till", icon: Crown, group: "Set up", render: () => <LoyaltyPage /> },
  { id: "services", label: "Services", icon: Scissors, group: "Set up", render: () => <ServicesPage /> },
  { id: "commission", label: "Commission", icon: Percent, group: "Set up", render: () => <CommissionPage /> },
  { id: "hardware", label: "Hardware", icon: Cpu, group: "Set up", render: () => <HardwarePage /> },
  { id: "offline", label: "Offline & sync", icon: WifiOff, group: "Set up", render: () => <OfflinePage /> },
];

export const go = (page: string) => (location.hash = `#pos-${page}`);

export default function Admin({
  section,
  page,
  staff,
  onSignOut,
}: {
  section: string;
  page: string;
  staff: Staff;
  onSignOut: () => void;
}) {
  const [posOpen, setPosOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const main = useRef<HTMLDivElement>(null);
  const current = section === "pos" ? POS_PAGES.find((p) => p.id === page) ?? POS_PAGES[0] : null;

  useEffect(() => {
    main.current?.scrollTo(0, 0);
    setMobileNav(false);
    // Same title pattern as the admin routes ("Pickups · ASL Admin").
    document.title = current ? `${current.label} · POS · ASL Admin` : "ASL Admin";
  }, [section, page, current]);

  // Item styles from the admin sidebar (AdminSidebar.tsx): white pill when active, white/70 otherwise.
  const item = (on: boolean) =>
    cx("relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors", on ? "bg-white font-semibold text-black" : "text-white/70 hover:bg-white/10 hover:text-white");
  const groupLabel = "px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40";
  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col bg-black text-white">
      <a href="#admin-dashboard" className="flex h-14 shrink-0 items-center gap-2 px-5">
        <span className="text-[13px] font-bold tracking-[0.18em] text-gold">ASL ORIGINALS</span>
        <span className="text-[9px] tracking-[0.3em] text-white/50">ADMIN</span>
      </a>
      <div className="side-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {EXISTING.map((g) => (
          <div key={g.id}>
            <p className={groupLabel}>{g.label}</p>
            {g.items.map(({ id, label, icon: Icon, badge }) => (
              <a key={id} href={`#admin-${id}`} aria-current={section === id ? "page" : undefined} className={item(section === id)}>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{label}</span>
                {badge && <span className="ml-auto rounded-full bg-gold/20 px-1.5 text-[10.5px] font-semibold text-gold">{badge}</span>}
              </a>
            ))}
            {/* The new POS group sits right after Sales. */}
            {g.id === "sales" && (
              <div className="mt-1 rounded-lg ring-1 ring-gold/40">
                <button onClick={() => setPosOpen(!posOpen)} aria-expanded={posOpen} className={cx(groupLabel, "flex w-full items-center gap-2 pt-3 text-left")}>
                  <span className={section === "pos" ? "text-white" : ""}>POS</span>
                  <span className="rounded bg-gold px-1.5 py-px text-[9px] font-bold tracking-wide text-white">NEW</span>
                  <ChevronDown size={13} className={cx("ml-auto transition-transform", !posOpen && "-rotate-90")} />
                </button>
                {posOpen && (
                  <div className="pb-1.5">
                    {["Operate", "Selling", "Set up"].map((sub) => (
                      <div key={sub}>
                        <p className="px-3 pb-0.5 pt-2 text-[10px] font-medium text-white/30">{sub}</p>
                        {POS_PAGES.filter((p) => p.group === sub).map((p) => {
                          const on = current?.id === p.id;
                          return (
                            <a key={p.id} href={`#pos-${p.id}`} aria-current={on ? "page" : undefined} className={item(on)}>
                              <p.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                              <span className="truncate">{p.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-white/10 p-3">
        <a href="#till" className="flex items-center gap-3 rounded-md bg-white/[0.06] p-2.5 text-[13px] transition-colors hover:bg-white/[0.1]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold">
            <MonitorSmartphone size={16} className="text-white" />
          </span>
          <span>
            <span className="block font-medium">Open the till</span>
            <span className="text-xs text-white/50">See these settings at work</span>
          </span>
        </a>
        <p className="mt-2 px-1 text-[10.5px] text-white/35">v1.0 · prototype</p>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full bg-canvas">
      <aside className="hidden w-[248px] shrink-0 lg:block">{nav}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar as in AdminTopbar.tsx: search with ⌘K, alerts, persona, avatar. */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
          <button className="lg:hidden" aria-label="Menu" onClick={() => setMobileNav(true)}>
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold tracking-[0.12em] lg:hidden">ASL ORIGINALS</span>
          <button className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 text-[13px] text-muted md:flex" aria-label="Search the admin">
            <Search size={15} />
            Search orders, products, customers…
            <kbd className="ml-auto rounded border border-line bg-white px-1.5 text-[11px] font-medium">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-canvas">
              <Bell size={18} />
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">3</span>
            </button>
            <AdminUserChip staff={staff} onSignOut={onSignOut} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          {mobileNav && (
            <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMobileNav(false)}>
              <aside className="anim-slide relative h-full w-[280px]" onClick={(e) => e.stopPropagation()}>
                <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="absolute right-2 top-3 z-10 p-2 text-white/70">
                  <X size={20} />
                </button>
                {nav}
              </aside>
            </div>
          )}
          <main ref={main} className="thin-scroll min-w-0 flex-1 overflow-y-auto">
            {current ? (
              <div className="mx-auto max-w-[1400px] p-4 lg:p-6">{current.render()}</div>
            ) : (
              <Existing item={EXISTING_ITEMS.find((e) => e.id === section) ?? EXISTING_ITEMS[0]} />
            )}
          </main>
        </div>
      </div>
      <Toaster className="right-6" />
    </div>
  );
}

/** What each existing admin page gets from the POS once it's built. */
const TOUCHES: Record<string, string> = {
  dashboard: "Revenue, orders and AOV include in-store sales, with a channel split (web, app, concierge, store).",
  activity: "Till sales, refunds and register openings show in the live feed.",
  orders: "Till sales land here next to website and app orders, with channel = store, the boutique and the cashier.",
  returns: "In-store returns and exchanges show here with the refund method (original payment, ASL Wallet or cash).",
  transactions: "Cash, card terminal, transfer, ASL Wallet and gift card payments from the tills, with references.",
  inventory: "The three boutiques become stock locations. Till sales, returns, transfers and counts post movements.",
  customers: "In-store purchases count towards spend, orders and tier. Staff see the same profile at the till.",
  club: "Points are earned and redeemed at the till with the same rules and multipliers. Ledger reason: “Order #… · in store”.",
  wallets: "Spend at the till is a “spend” entry; in-store refunds and cancelled deposits are “refund” entries, channel pos.",
  coupons: "Codes get a fourth channel, “In store”, which decides whether the till accepts them.",
  pickups: "The till's Pickups screen works these bookings: ready, collected with the pickup code, no-show.",
  "shipping-zones": "Ship-to-customer sales at the till use these zones and fees.",
  reports: "Adds Z reports, daily cash reconciliation and staff sales to the library.",
  ledger: "Cash in drawers and card-terminal settlements need two new accounts. Gift cards use 2200 Gift card liability.",
  team: "Adds three store roles (Store Manager, Supervisor, Cashier) with till PINs and boutiques.",
  audit: "Till approvals, price changes, refunds and cash movements arrive with category “pos”.",
  "notification-settings": "New alerts: cash difference at close, large in-store sale, till offline.",
  inbox: "Staff can start a concierge request from the till for an item the boutique doesn't have.",
  messaging: "Till receipts, pickup-ready, reservation, alteration and gift card messages are sent from new templates here, by email, SMS, WhatsApp or push.",
  campaigns: "Customers signed up at the till join the same segments.",
};

function Existing({ item }: { item: (typeof EXISTING_ITEMS)[number] }) {
  const touch = TOUCHES[item.id];
  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <h1 className="text-[28px] font-bold leading-tight">{item.label}</h1>
      <p className="mt-1 text-[13px] text-muted">
        Existing page · <span className="font-mono">{item.to}</span>
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-white p-10 text-center">
        <p className="font-medium">This page is already built in the ASL ORIGINALS admin.</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted">{touch ? `With the POS: ${touch}` : "The POS doesn't change this page."}</p>
        <a href="#pos-overview" className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-[13px] font-medium text-white">
          <Check size={15} />
          Go to the new POS menu
        </a>
      </div>
    </div>
  );
}

/* Shared layout pieces for the POS admin pages, styled like the admin's PageHeader, Card and tables. */

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">POS</p>
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, sub, children, aside }: { title: string; sub?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-7 first:border-t-0 first:pt-0 lg:grid-cols-[280px_1fr]">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</p>}
        {aside}
      </div>
      <div className="rounded-xl border border-line bg-white px-5 py-2 shadow-card">{children}</div>
    </section>
  );
}

export function SavedNote() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1.5 text-xs font-medium text-good">
      <Check size={13} />
      Saves automatically · tills update in seconds
    </span>
  );
}

export function RowField({ label, sub, children }: { label: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-3.5 last:border-b-0">
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  );
}

export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <th className={cx("whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted", right ? "text-right" : "text-left", className)}>{children}</th>;
}
export function Td({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={cx("px-4 py-3", right && "text-right", className)}>{children}</td>;
}
