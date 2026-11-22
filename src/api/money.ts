/** UI uses whole naira; Nest APIs use kobo. */

export const toKobo = (naira: number) => Math.round(naira * 100);
export const fromKobo = (kobo: number) => Math.round(kobo / 100);

export const toKoboDisc = (d?: { type: "percent" | "amount"; value: number; max?: number; reason?: string }) => {
  if (!d) return undefined;
  if (d.type === "percent") return { type: "percent" as const, value: d.value, max: d.max != null ? toKobo(d.max) : undefined };
  return { type: "amount" as const, value: toKobo(d.value), max: d.max != null ? toKobo(d.max) : undefined };
};
