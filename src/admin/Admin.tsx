import { ReactNode, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Building2,
  Check,
  Cpu,
  Crown,
  FileText,
  Gauge,
  Gift,
  HandCoins,
  Menu,
  MonitorSmartphone,
  Percent,
  ReceiptText,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  UserCog,
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
  page,
  staff,
  onSignOut,
}: {
  section?: string;
  page: string;
  staff: Staff;
  onSignOut: () => void;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const main = useRef<HTMLDivElement>(null);
  const current = POS_PAGES.find((p) => p.id === page) ?? POS_PAGES[0];

  useEffect(() => {
    main.current?.scrollTo(0, 0);
    setMobileNav(false);
    document.title = `${current.label} · POS · ASL`;
  }, [page, current]);

  const item = (on: boolean) =>
    cx("relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors", on ? "bg-white font-semibold text-black" : "text-white/70 hover:bg-white/10 hover:text-white");
  const groupLabel = "px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40";

  const nav = (
    <nav aria-label="POS admin" className="flex h-full flex-col bg-black text-white">
      <a href="#pos-overview" className="flex h-14 shrink-0 items-center gap-2 px-5">
        <span className="text-[13px] font-bold tracking-[0.18em] text-gold">ASL ORIGINALS</span>
        <span className="text-[9px] tracking-[0.3em] text-white/50">POS</span>
      </a>
      <div className="side-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {["Operate", "Selling", "Set up"].map((sub) => (
          <div key={sub}>
            <p className={groupLabel}>{sub}</p>
            {POS_PAGES.filter((p) => p.group === sub).map((p) => {
              const on = current.id === p.id;
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
      <div className="shrink-0 border-t border-white/10 p-3">
        <a href="#till" className="flex items-center gap-3 rounded-md bg-white/[0.06] p-2.5 text-[13px] transition-colors hover:bg-white/[0.1]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold">
            <MonitorSmartphone size={16} className="text-white" />
          </span>
          <span>
            <span className="block font-medium">Open the till</span>
            <span className="text-xs text-white/50">Back to selling</span>
          </span>
        </a>
      </div>
    </nav>
  );

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-canvas">
      <aside className="hidden h-full w-[248px] shrink-0 self-stretch lg:flex lg:flex-col">{nav}</aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
          <button className="lg:hidden" aria-label="Menu" onClick={() => setMobileNav(true)}>
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold tracking-[0.12em] lg:hidden">ASL POS</span>
          <p className="hidden text-[13px] text-muted md:block">{current.label}</p>
          <div className="ml-auto flex items-center gap-2">
            <AdminUserChip staff={staff} onSignOut={onSignOut} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {mobileNav && (
            <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMobileNav(false)}>
              <aside className="anim-slide relative flex h-full w-[280px] flex-col" onClick={(e) => e.stopPropagation()}>
                <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="absolute right-2 top-3 z-10 p-2 text-white/70">
                  <X size={20} />
                </button>
                {nav}
              </aside>
            </div>
          )}
          <main ref={main} className="thin-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[1400px] p-4 pb-8 lg:p-6 lg:pb-10">{current.render()}</div>
          </main>
        </div>
      </div>
      <Toaster className="right-6" />
    </div>
  );
}

/* Shared layout pieces for the POS admin pages */

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
  return <td className={cx("px-4 py-3 text-[13px]", right ? "text-right" : "text-left", className)}>{children}</td>;
}
