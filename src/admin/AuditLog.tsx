import { useEffect, useMemo, useState } from "react";
import { ApiError, liveMode } from "../api/client";
import { fromKobo } from "../api/money";
import { adminPosApi } from "../api/pos";
import { ArrowLeftRight, BadgePercent, Banknote, CalendarClock, ClipboardCheck, Download, Gift, Inbox, PackageMinus, RotateCcw, ShieldCheck, Tag, Trash2, Sparkles } from "lucide-react";
import { useDb } from "../data/store";
import type { AuditEvent } from "../data/types";
import { naira } from "../lib/pricing";
import { Avatar, Badge, Button, Empty, Select, Stat, Toggle, fmtDate, fmtTime, toast, type Tone } from "../ui/kit";
import { PageHead, Td, Th } from "./Admin";

const ACTIONS: Record<AuditEvent["action"], { label: string; icon: typeof Tag; tone: Tone }> = {
  discount: { label: "Discount", icon: BadgePercent, tone: "gold" },
  price: { label: "Price change", icon: Tag, tone: "warn" },
  refund: { label: "Refund", icon: RotateCcw, tone: "bad" },
  void: { label: "Cleared sale", icon: Trash2, tone: "bad" },
  cash: { label: "Cash in/out", icon: Banknote, tone: "neutral" },
  drawer: { label: "No-sale drawer", icon: Inbox, tone: "warn" },
  stock: { label: "Stock adjustment", icon: PackageMinus, tone: "neutral" },
  count: { label: "Stock count", icon: ClipboardCheck, tone: "neutral" },
  transfer: { label: "Transfer", icon: ArrowLeftRight, tone: "info" },
  giftcard: { label: "Gift card", icon: Gift, tone: "gold" },
  reservation: { label: "Reservation", icon: CalendarClock, tone: "info" },
  concierge: { label: "Concierge", icon: Sparkles, tone: "gold" },
};

type ApiAudit = {
  id: string;
  at: string;
  locationId: string | null;
  staffId: string;
  approvedById: string | null;
  action: string;
  text: string;
  amount: number | null;
  ref: string | null;
};

export default function AuditLog() {
  const log = useDb((s) => s.auditLog);
  const staff = useDb((s) => s.staff);
  const stores = useDb((s) => s.stores);
  const live = liveMode();
  const [remote, setRemote] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("all");
  const [store, setStore] = useState("all");
  const [who, setWho] = useState("all");
  const [approvals, setApprovals] = useState(false);

  useEffect(() => {
    if (!live) return;
    adminPosApi
      .audit()
      .then((rows) => {
        const mapped = (rows as ApiAudit[]).map((e) => ({
          id: e.id,
          at: typeof e.at === "string" ? e.at : new Date(e.at).toISOString(),
          storeId: e.locationId ?? undefined,
          staffId: e.staffId,
          approvedBy: e.approvedById ?? undefined,
          action: e.action as AuditEvent["action"],
          text: e.text,
          amount: e.amount != null ? fromKobo(e.amount) : undefined,
          ref: e.ref ?? undefined,
        }));
        setRemote(mapped);
      })
      .catch((err) => toast(err instanceof ApiError ? err.message : "Could not load audit log"));
  }, [live]);

  const source = live ? remote : log;

  const rows = useMemo(
    () => source.filter((e) => (action === "all" || e.action === action) && (store === "all" || e.storeId === store) && (who === "all" || e.staffId === who || e.approvedBy === who) && (!approvals || !!e.approvedBy)),
    [source, action, store, who, approvals],
  );
  const week = useMemo(() => source.filter((e) => Date.now() - new Date(e.at).getTime() < 7 * 86400e3), [source]);
  const name = (id?: string) => staff.find((s) => s.id === id)?.name;
  const count = (a: AuditEvent["action"]) => week.filter((e) => e.action === a).length;

  return (
    <>
      <PageHead
        title="Audit log"
        sub="Every sensitive action at the tills: discounts, price changes, refunds, cleared sales, cash and stock. Who did it, who approved it, and when. Entries can't be edited or deleted."
        actions={
          <Button icon={<Download size={16} />} onClick={() => toast(`Exported ${rows.length} audit entries to CSV`)}>
            Export CSV
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Approvals this week" value={week.filter((e) => e.approvedBy).length} sub="PIN overrides by a supervisor or manager" />
        <Stat label="Refunds this week" value={count("refund")} sub={naira(week.filter((e) => e.action === "refund").reduce((a, e) => a + (e.amount ?? 0), 0))} />
        <Stat label="Cleared sales" value={count("void")} sub="Baskets emptied with items in" />
        <Stat label="No-sale drawer opens" value={count("drawer")} sub="Watch for a pattern" />
      </div>
      <div className="my-4 flex flex-wrap items-center gap-2">
        <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} className="w-auto">
          <option value="all">All actions</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Store" value={store} onChange={(e) => setStore(e.target.value)} className="w-auto">
          <option value="all">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Staff" value={who} onChange={(e) => setWho(e.target.value)} className="w-auto">
          <option value="all">All staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <span className="ml-1 flex items-center gap-2 text-[13px]">
          <Toggle ariaLabel="Approvals only" checked={approvals} onChange={setApprovals} />
          Approvals only
        </span>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="tnum w-full text-[13px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>What happened</Th>
                <Th>By</Th>
                <Th>Approved by</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const a = ACTIONS[e.action] ?? { label: e.action, icon: ShieldCheck, tone: "neutral" as Tone };
                const st = stores.find((s) => s.id === e.storeId);
                return (
                  <tr key={e.id} data-testid="audit-row">
                    <Td className="whitespace-nowrap">
                      <span className="block font-medium">{fmtTime(e.at)}</span>
                      <span className="text-xs text-muted">{fmtDate(e.at)}</span>
                    </Td>
                    <Td>
                      <Badge tone={a.tone}>
                        <a.icon size={12} className="mr-1" />
                        {a.label}
                      </Badge>
                    </Td>
                    <Td className="min-w-[260px]">
                      {e.text}
                      <span className="block text-xs text-muted">
                        {st?.name ?? "Admin"}
                        {e.ref && ` · ${e.ref}`}
                      </span>
                    </Td>
                    <Td>
                      {name(e.staffId) ? (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar name={name(e.staffId)!} size={24} />
                          {name(e.staffId)!.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-faint">–</span>
                      )}
                    </Td>
                    <Td>
                      {e.approvedBy ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-gold-ink">
                          <ShieldCheck size={14} />
                          {name(e.approvedBy)?.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-faint">–</span>
                      )}
                    </Td>
                    <Td right className="font-medium">
                      {e.amount ? naira(e.amount) : <span className="font-normal text-faint">–</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<ShieldCheck size={20} />} title="Nothing matches" body="Change the filters to see more." />
      )}
    </>
  );
}
