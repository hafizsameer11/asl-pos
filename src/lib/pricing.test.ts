import { describe, expect, it } from "vitest";
import { allocate, quote, refundFor, vatOf } from "./pricing";
import { COUPONS, CUSTOMERS, DEFAULT_SETTINGS, buildCatalogue } from "../data/seed";

const settings = DEFAULT_SETTINGS;

describe("quote", () => {
  it("applies line discounts, then the coupon, then a manual discount, then points", () => {
    const customer = { ...CUSTOMERS[0], loyaltyPoints: 1000 };
    const q = quote({
      lines: [
        { qty: 2, unitPrice: 100000, discount: { type: "percent", value: 10 } },
        { qty: 1, unitPrice: 50000 },
      ],
      coupon: COUPONS[0],
      couponCode: "WELCOME10",
      manual: { type: "amount", value: 5000 },
      pointsToUse: 100,
      customer,
      settings,
    });
    expect(q.subtotal).toBe(250000);
    expect(q.lineDiscounts).toBe(20000);
    expect(q.coupon).toBe(23000);
    expect(q.manual).toBe(5000);
    expect(q.points).toBe(2500);
    expect(q.total).toBe(199500);
    expect(q.lines.reduce((a, l) => a + l.net, 0)).toBe(q.total);
    expect(q.earn).toBe(Math.floor(199.5 * settings.loyalty.multipliers[customer.tier]));
  });

  it("rejects coupons that are online-only or under the minimum spend", () => {
    expect(quote({ lines: [{ qty: 1, unitPrice: 300000 }], coupon: COUPONS[2], couponCode: "SNEAKER15", pointsToUse: 0, settings }).couponError).toMatch(/online/);
    expect(quote({ lines: [{ qty: 1, unitPrice: 30000 }], coupon: COUPONS[0], couponCode: "WELCOME10", pointsToUse: 0, settings }).couponError).toMatch(/spend/);
  });

  it("caps a percent coupon at its maximum discount, as the admin sets it", () => {
    expect(quote({ lines: [{ qty: 1, unitPrice: 1000000 }], coupon: COUPONS[1], couponCode: "VIP25", pointsToUse: 0, settings }).coupon).toBe(200000);
  });

  it("never redeems more points than the customer has", () => {
    const q = quote({ lines: [{ qty: 1, unitPrice: 100000 }], pointsToUse: 9999, customer: { ...CUSTOMERS[5], loyaltyPoints: 50 }, settings });
    expect(q.pointsUsed).toBe(50);
  });
});

describe("money helpers", () => {
  it("allocates exactly", () => expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b)).toBe(100));
  it("works out inclusive VAT", () => expect(vatOf(107500, 7.5)).toBe(7500));
  it("refunds exactly what was paid across partial returns", () => {
    const a = refundFor(100, 3, 0, 0, 1);
    const b = refundFor(100, 3, 1, a, 1);
    const c = refundFor(100, 3, 2, a + b, 1);
    expect(a + b + c).toBe(100);
    expect(refundFor(100, 3, 3, 100, 1)).toBe(0);
  });
});

describe("sample catalogue", () => {
  it("has unique barcodes and SKUs", () => {
    const vs = buildCatalogue().products.flatMap((p) => p.variants);
    expect(new Set(vs.map((v) => v.barcode)).size).toBe(vs.length);
    expect(new Set(vs.map((v) => v.sku)).size).toBe(vs.length);
  });
});
