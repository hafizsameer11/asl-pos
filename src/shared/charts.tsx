import { useState } from "react";
import { naira } from "../lib/pricing";
import { cx } from "../ui/kit";

/** Single-series column chart with a hover readout. */
export function Columns({ data, height = 160, format = naira, testId }: { data: { label: string; value: number; hint?: string }[]; height?: number; format?: (n: number) => string; testId?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(1, ...data.map((d) => d.value));
  const shown = active ?? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  return (
    <div data-testid={testId}>
      <p className="tnum mb-3 text-[13px] text-muted">
        <span className="font-medium text-ink">{data[shown]?.hint ?? data[shown]?.label}</span> · {format(data[shown]?.value ?? 0)}
        {active === null && <span> (best)</span>}
      </p>
      <div className="flex items-end gap-1 border-b border-line" style={{ height }} onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <button key={i} tabIndex={-1} aria-hidden onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} className={cx("flex h-full flex-1 items-end justify-center rounded-t", active === i && "bg-canvas")}>
            {d.value > 0 && <span className={cx("w-full max-w-[22px] rounded-t-[4px]", active === i ? "bg-gold-ink" : "bg-gold")} style={{ height: `${Math.max(3, (d.value / peak) * 100)}%` }} />}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-faint">
            {data.length > 12 && i % 2 ? "" : d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bars with labels and values, for rankings and splits. */
export function Bars({ data, format = naira }: { data: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const peak = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="tnum mb-1 flex justify-between gap-3 text-[13px]">
            <span className="truncate">
              {d.label}
              {d.sub && <span className="ml-1.5 text-faint">{d.sub}</span>}
            </span>
            <span className="font-medium">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-canvas">
            <div className="h-2 rounded-full bg-gold" style={{ width: `${(d.value / peak) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
