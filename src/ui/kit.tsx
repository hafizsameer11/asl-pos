import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, forwardRef, useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { Channel, OrderStatus, Tier } from "../data/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* Buttons */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" | "soft";
  size?: "sm" | "md" | "lg" | "xl";
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", size = "md", icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-9 px-3 text-[13px]",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        size === "xl" && "h-14 px-6 text-base",
        variant === "primary" && "bg-ink text-white hover:bg-ink-2",
        variant === "secondary" && "border border-line bg-white text-ink hover:border-line-strong hover:bg-canvas",
        variant === "ghost" && "text-ink-2 hover:bg-black/[0.04]",
        variant === "danger" && "border border-bad/25 bg-white text-bad hover:bg-bad-soft",
        variant === "gold" && "bg-gold text-white hover:bg-gold-ink",
        variant === "soft" && "bg-canvas text-ink hover:bg-line",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...rest} className={cx("inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.05] hover:text-ink disabled:opacity-30", className)}>
      {children}
    </button>
  );
}

/* Form */

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(function Input({ className, prefix, ...rest }, ref) {
  const input = (
    <input
      ref={ref}
      {...rest}
      className={cx("h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-ink disabled:bg-canvas disabled:text-muted", prefix && "pl-8", className)}
    />
  );
  if (!prefix) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>
      {input}
    </div>
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx("h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink", !/(^|\s)w-/.test(className ?? "") && "w-full", className)}>
      {children}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder, className, autoFocus, onEnter, inputRef }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean; onEnter?: () => void; inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <div className={cx("relative", className)}>
      <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-10 text-sm outline-none placeholder:text-faint focus:border-ink"
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-faint hover:text-ink">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** With `label` it renders a labelled settings row; with only `ariaLabel` it's a bare switch for tables. */
export function Toggle({ checked, onChange, label, ariaLabel, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; ariaLabel?: string; description?: ReactNode; disabled?: boolean }) {
  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", checked ? "bg-ink" : "bg-line-strong")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {sw}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-lg bg-canvas p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("rounded-md px-3 font-medium transition-colors", size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm", value === o.value ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors", active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-line-strong")}>
      {children}
      {count !== undefined && <span className={cx("tnum text-xs", active ? "text-white/70" : "text-faint")}>{count}</span>}
    </button>
  );
}

/* Surfaces */

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-line bg-white shadow-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "gold" | "dark";

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium",
        tone === "neutral" && "bg-canvas text-ink-2",
        tone === "good" && "bg-good-soft text-good",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "info" && "bg-info-soft text-info",
        tone === "gold" && "bg-gold-soft text-gold-ink",
        tone === "dark" && "bg-ink text-white",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const TIER_TONE: Record<Tier, Tone> = { Standard: "neutral", Silver: "info", Gold: "gold", Signature: "dark" };
export function TierBadge({ tier }: { tier: Tier }) {
  return <Badge tone={TIER_TONE[tier]}>{tier}</Badge>;
}

export const CHANNEL_LABEL: Record<Channel, string> = { pos: "In store", web: "Website", app: "App" };
export function ChannelBadge({ channel }: { channel: Channel }) {
  return <Badge tone={channel === "pos" ? "neutral" : "info"}>{CHANNEL_LABEL[channel]}</Badge>;
}

const STATUS: Record<OrderStatus, [string, Tone]> = {
  reserved: ["Reservation", "gold"],
  completed: ["Completed", "good"],
  processing: ["To pack", "warn"],
  ready: ["Ready for pickup", "info"],
  collected: ["Collected", "good"],
  delivered: ["Delivered", "good"],
  refunded: ["Refunded", "bad"],
  "part-refunded": ["Part refunded", "warn"],
  cancelled: ["Cancelled", "neutral"],
};
export function StatusBadge({ status }: { status: OrderStatus }) {
  const [text, tone] = STATUS[status];
  return (
    <Badge tone={tone} dot>
      {text}
    </Badge>
  );
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", className)} style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 35% 30%)` }}>
      {initials}
    </span>
  );
}

export function Swatch({ hex, size = 14, ring }: { hex: string; size?: number; ring?: boolean }) {
  return <span className={cx("inline-block shrink-0 rounded-full border border-black/10", ring && "ring-2 ring-white")} style={{ background: hex, width: size, height: size }} />;
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted">{icon}</span>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, delta, sub }: { label: string; value: ReactNode; delta?: number; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-card">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="tnum mt-1.5 text-[26px] font-semibold leading-tight tracking-tight">{value}</p>
      <p className="tnum mt-1 flex items-center gap-1.5 text-xs text-muted">
        {delta !== undefined && Number.isFinite(delta) && <span className={delta >= 0 ? "font-medium text-good" : "font-medium text-bad"}>{`${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}%`}</span>}
        {sub}
      </p>
    </div>
  );
}

/* Overlays */

function useEsc(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
}

export function Dialog({ title, sub, onClose, children, footer, size = "md" }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEsc(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "anim-rise flex max-h-[94%] w-full flex-col rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-3xl",
          size === "xl" && "sm:max-w-5xl",
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X size={20} />
          </IconButton>
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function Sheet({ title, sub, onClose, children, footer, width = 520 }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEsc(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/25" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"} className="anim-slide flex h-full w-full flex-col bg-white shadow-pop" style={{ maxWidth: width }}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* Toasts */

type ToastT = { id: number; text: string; tone: "good" | "bad" | "info"; action?: { label: string; run: () => void } };
let push: ((t: ToastT) => void) | null = null;
let seq = 0;
export function toast(text: string, tone: ToastT["tone"] = "good", action?: ToastT["action"]) {
  push?.({ id: ++seq, text, tone, action });
}

export function Toaster({ className }: { className?: string }) {
  const [items, setItems] = useState<ToastT[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((x) => [...x.slice(-1), t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.action ? 6000 : 2800);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div aria-live="polite" className={cx("pointer-events-none fixed bottom-5 z-[60] flex flex-col items-center gap-2", className ?? "left-1/2 -translate-x-1/2")}>
      {items.map((t) => (
        <div key={t.id} className="anim-rise pointer-events-auto flex items-center gap-3 rounded-xl bg-ink py-2.5 pl-3 pr-4 text-sm font-medium text-white shadow-pop">
          <span className={cx("flex h-5 w-5 items-center justify-center rounded-full", t.tone === "good" ? "bg-good" : t.tone === "bad" ? "bg-bad" : "bg-info")}>{t.tone === "bad" ? <X size={12} /> : <Check size={12} />}</span>
          {t.text}
          {t.action && (
            <button onClick={t.action.run} className="ml-1 font-semibold text-[#f2a679] underline-offset-2 hover:underline">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* Misc */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-sans text-[11px] text-muted">{children}</kbd>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-line", className)} />;
}

export function Row({ label, value, strong, muted, className }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cx("tnum flex items-baseline justify-between gap-4", strong && "font-semibold", muted && "text-muted", className)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
