import { describe, expect, it } from "vitest";
import { applyPromos, livePromos, quote } from "./pricing";
import { CUSTOMERS, DEFAULT_SETTINGS, PROMOTIONS } from "../data/seed";
import type { Promotion } from "../data/types";

const P = (id: string) => PROMOTIONS.find((p) => p.id === id)!;

describe("automatic promotions", () => {
  it("buy 2 get 1 makes the cheapest of every three free", () => {
    const lines = [
      { qty: 2, unitPrice: 100000, category: "Accessories" as const },
      { qty: 1, unitPrice: 40000, category: "Accessories" as const },
      { qty: 1, unitPrice: 300000, category: "Fragrances" as const },
    ];
    const r = applyPromos(lines, lines.map((l) => l.qty * l.unitPrice), [P("pr1")]);
    expect(r.off).toEqual([0, 40000, 0]);
    expect(r.applied[0].amount).toBe(40000);
  });

  it("spend promotion only applies once the scope reaches the minimum", () => {
    const under = [{ qty: 1, unitPrice: 285000, category: "Fragrances" as const }];
    expect(applyPromos(under, [285000], [P("pr3")]).applied).toHaveLength(0);
    const over = [...under, { qty: 1, unitPrice: 148000, category: "Fragrances" as const }];
    const r = applyPromos(over, [285000, 148000], [P("pr3")]);
    expect(r.off.reduce((a, b) => a + b, 0)).toBe(40000);
  });

  it("skips lines with a manual discount and gives birthday customers their treat", () => {
    const lines = [
      { qty: 1, unitPrice: 100000, noPromo: true },
      { qty: 1, unitPrice: 100000 },
    ];
    const bday = { ...CUSTOMERS[0], birthday: `${String(new Date().getMonth() + 1).padStart(2, "0")}-01` };
    expect(applyPromos(lines, [100000, 100000], [P("pr4")], bday).off).toEqual([0, 10000]);
    expect(applyPromos(lines, [100000, 100000], [P("pr4")], { ...bday, birthday: undefined }).off).toEqual([0, 0]);
  });

  it("only runs promotions that are live for this channel and store", () => {
    const ids = livePromos(PROMOTIONS, "pos", "LOC-1003").map((p) => p.id);
    expect(ids).toContain("pr1");
    expect(ids).not.toContain("pr2"); // Ikoyi and Lekki only
    expect(ids).not.toContain("pr5"); // starts later
    expect(ids).not.toContain("pr6"); // paused
  });

  it("adds gift cards and fees after discounts, without VAT or points on gift cards", () => {
    const pct: Promotion = { ...P("pr2"), scope: { type: "all" } };
    const q = quote({ lines: [{ qty: 1, unitPrice: 100000 }], pointsToUse: 0, settings: DEFAULT_SETTINGS, customer: { ...CUSTOMERS[3], tier: "Standard" }, promos: [pct], extras: [{ kind: "giftcard", amount: 50000 }, { kind: "delivery", amount: 5000 }] });
    expect(q.promoTotal).toBe(10000);
    expect(q.total).toBe(90000 + 55000);
    expect(q.vat).toBe(Math.round((95000 * 7.5) / 107.5));
    expect(q.earn).toBe(90);
    expect(q.lines[0].net).toBe(90000);
  });
});
