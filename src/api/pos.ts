import { api, setTokens, clearTokens } from "./client";
import { fromKobo, toKobo, toKoboDisc } from "./money";
import { useDb, type Cart } from "../data/store";
import type { Payment, Staff } from "../data/types";
import type { Disc } from "../lib/pricing";

export type ApiStaff = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  locationIds: string[];
  discountLimitPct?: number;
};

export type ApiRegister = {
  id: string;
  name: string;
  locationId: string;
  location: { id: string; name: string; city: string } | null;
  warehouse: { id: string; code: string; name: string };
  device: string | null;
  terminalId: string | null;
  online: boolean;
  lastSeenAt: string | null;
  openSession: { id: string; openedAt: string; float: number; openedById: string } | null;
};

function mapRole(role: string): Staff["role"] {
  if (role === "store_manager" || role === "super_admin" || role === "ops_manager") return "Manager";
  if (role === "store_supervisor") return "Supervisor";
  return "Cashier";
}

export function toStaff(me: ApiStaff): Staff {
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    role: mapRole(me.role),
    pin: "****",
    storeIds: me.locationIds ?? [],
    active: true,
    permissions: me.permissions,
    discountLimitPct: me.discountLimitPct,
  };
}

export const posApi = {
  async pinLogin(pin: string, registerId?: string) {
    const out = await api<{
      accessToken: string;
      refreshToken: string;
      staff: ApiStaff & { roleLabel?: string };
      registerId: string | null;
    }>("/auth/pin", { method: "POST", body: { pin, registerId }, auth: false });
    setTokens(out.accessToken, out.refreshToken);
    if (registerId) localStorage.setItem("asl-pos-register", registerId);
    return out;
  },

  /** Validate a manager PIN without replacing the signed-in till session tokens. */
  async verifyPin(pin: string) {
    const out = await api<{
      accessToken: string;
      refreshToken: string;
      staff: ApiStaff & { roleLabel?: string };
      registerId: string | null;
    }>("/auth/pin", { method: "POST", body: { pin }, auth: false });
    return { staff: toStaff(out.staff), raw: out.staff };
  },

  logout() {
    clearTokens();
  },

  me: () => api<ApiStaff>("/me"),
  settings: () => api<Record<string, unknown>>("/settings"),
  listRegisters: () => api<ApiRegister[]>("/registers"),

  openSession: (registerId: string, floatNaira?: number) =>
    api<{ id: string; float: number; openedAt: string }>("/registers/" + registerId + "/open", {
      method: "POST",
      body: { float: floatNaira != null ? toKobo(floatNaira) : undefined },
      registerId,
    }),

  cashMove: (sessionId: string, type: "in" | "out", amountNaira: number, reason: string) =>
    api(`/sessions/${sessionId}/cash-moves`, {
      method: "POST",
      body: { type, amount: toKobo(amountNaira), reason },
    }),

  closeSession: (sessionId: string, countedNaira: number, note?: string) =>
    api(`/sessions/${sessionId}/close`, {
      method: "POST",
      body: { counted: toKobo(countedNaira), note },
    }),

  zReport: (sessionId: string) => api(`/sessions/${sessionId}/z-report`),

  catalog: (q?: { q?: string; page?: number; pageSize?: number; barcode?: string; sku?: string }) =>
    api<CatalogProduct[]>("/catalog", {
      query: { page: q?.page ?? 1, pageSize: q?.pageSize ?? 100, q: q?.q, barcode: q?.barcode, sku: q?.sku },
    }).then((r) => (Array.isArray(r) ? r : [])),

  searchCustomers: (q: string) =>
    api<ApiCustomer[]>("/customers", { query: { q, page: 1, pageSize: 30 } }).then((r) =>
      (Array.isArray(r) ? r : []).map(mapCustomer),
    ),

  createCustomer: async (c: { name: string; phone?: string; email?: string }) => {
    const [firstName, ...rest] = c.name.trim().split(/\s+/);
    const raw = await api<ApiCustomer>("/customers", {
      method: "POST",
      body: { firstName: firstName || c.name, lastName: rest.join(" ") || undefined, phone: c.phone, email: c.email },
    });
    return mapCustomer(raw);
  },

  quote: (cart: Cart, fulfilment: "instore" | "ship" | "layaway" = "instore") =>
    api<QuoteResult>("/sales/quote", {
      method: "POST",
      body: cartToQuoteBody(cart, fulfilment),
    }).then(mapQuote),

  completeSale: (cart: Cart, payments: Payment[], changeNaira: number, opts: {
    registerSessionId: string;
    fulfilment?: "instore" | "ship" | "layaway";
    depositNaira?: number;
    clientKey?: string;
    note?: string;
    approvedById?: string;
  }) =>
    api<SaleResult>("/sales", {
      method: "POST",
      body: posApi.completeSaleBody(cart, payments, changeNaira, opts),
      idempotencyKey: opts.clientKey && opts.clientKey.length >= 8 ? opts.clientKey : `sale-${crypto.randomUUID()}`,
    }).then(mapSale),

  syncSales: (sales: unknown[]) => api("/sales/sync", { method: "POST", body: { sales } }),

  /** Body shape for offline sync / complete sale (kobo). */
  completeSaleBody(
    cart: Cart,
    payments: Payment[],
    changeNaira: number,
    opts: {
      registerSessionId: string;
      fulfilment?: "instore" | "ship" | "layaway";
      depositNaira?: number;
      clientKey?: string;
      note?: string;
      approvedById?: string;
    },
  ) {
    return {
      ...cartToQuoteBody(cart, opts.fulfilment ?? "instore"),
      registerSessionId: opts.registerSessionId,
      payments: payments.map((p) => ({
        method: p.method === "giftcard" ? "giftcard" : p.method,
        amount: toKobo(p.amount),
        reference: p.reference,
      })),
      change: toKobo(changeNaira),
      note: opts.note ?? cart.note,
      clientKey: opts.clientKey,
      approvedById: opts.approvedById,
      deposit: opts.depositNaira != null ? toKobo(opts.depositNaira) : undefined,
      extras: [
        ...(cart.giftCards ?? []).map((g) => ({ kind: "giftcard" as const, label: "Gift card", amount: toKobo(g.amount) })),
        ...(cart.alterations ?? []).filter((a) => a.fee > 0).map((a) => ({ kind: "alteration" as const, label: a.item, amount: toKobo(a.fee) })),
        ...(cart.delivery ? [{ kind: "delivery" as const, label: cart.delivery.zone, amount: toKobo(cart.delivery.fee) }] : []),
      ],
      shippingAddress: cart.delivery
        ? {
            fullName: cart.delivery.name,
            phone: cart.delivery.phone,
            address: cart.delivery.address,
            city: cart.delivery.city,
            state: cart.delivery.city,
            country: "NG",
          }
        : undefined,
    };
  },

  getSale: (id: string) => api<SaleResult>(`/sales/${id}`).then(mapSale),

  listSales: (q?: {
    fulfilment?: "instore" | "ship" | "layaway";
    locationId?: string;
    channel?: "store" | "web" | "all";
    page?: number;
    pageSize?: number;
    q?: string;
  }) =>
    api("/sales", {
      query: { page: q?.page ?? 1, pageSize: q?.pageSize ?? 50, fulfilment: q?.fulfilment, locationId: q?.locationId, channel: q?.channel, q: q?.q },
    }),

  advanceShip: (id: string, status: "shipped" | "delivered") =>
    api(`/sales/${id}/advance-ship`, { method: "POST", body: { status } }).then((r) => mapSale(r as SaleResult)),

  sendReceipt: (id: string, channel: "email" | "sms" | "whatsapp", gift = false, to?: string) =>
    api(`/sales/${id}/send-receipt`, { method: "POST", body: { channel, gift, to } }),

  returnable: (id: string) => api(`/sales/${id}/returnable`),

  processReturn: (
    id: string,
    body: {
      lines: { orderItemId: string; qty: number }[];
      reason: string;
      refundTo: "original" | "wallet" | "cash";
      restock?: boolean;
      override?: boolean;
      registerSessionId?: string;
      approvedById?: string;
    },
  ) => api(`/sales/${id}/returns`, { method: "POST", body }),

  settleLayaway: (id: string, payments: Payment[], changeNaira: number, registerSessionId?: string) =>
    api(`/sales/${id}/layaway/settle`, {
      method: "POST",
      body: {
        payments: payments.map((p) => ({ method: p.method, amount: toKobo(p.amount), reference: p.reference })),
        change: toKobo(changeNaira),
        registerSessionId,
      },
    }),

  cancelLayaway: (id: string, body?: { forfeitDeposit?: boolean; refundTo?: "kept" | "wallet" | "original" }) =>
    api(`/sales/${id}/layaway/cancel`, { method: "POST", body: body ?? {} }),

  pickups: (q?: { status?: string; q?: string }) =>
    api("/pickups", { query: { page: 1, pageSize: 50, ...q } }),

  pickupReady: (id: string) => api(`/pickups/${id}/ready`, { method: "POST", body: {} }),
  pickupCollect: (id: string, body: { code?: string; idChecked?: boolean; collectedBy?: string }) =>
    api(`/pickups/${id}/collect`, { method: "POST", body }),

  giftCard: (code: string) => api(`/gift-cards/${encodeURIComponent(code)}`).then((g: any) => ({
    ...g,
    initial: fromKobo(g.initial),
    balance: fromKobo(g.balance),
  })),

  issueGiftCard: (amountNaira: number, opts?: { customerId?: string; locationId?: string }) =>
    api("/gift-cards", { method: "POST", body: { amount: toKobo(amountNaira), ...opts } }),

  promotions: () => api("/promotions"),

  createAlteration: (body: Record<string, unknown>) => api("/alterations", { method: "POST", body }),
  listAlterations: async (locationId?: string) => {
    const r = await api<unknown>("/alterations", { query: { page: 1, pageSize: 50, locationId } });
    const rows = Array.isArray(r) ? r : [];
    return rows.map((a: any) => ({
      id: a.id,
      number: a.number,
      customerId: a.customerId ?? undefined,
      customerName: a.customerName,
      phone: a.phone ?? "",
      orderNumber: a.orderNumber ?? undefined,
      item: a.item,
      work: Array.isArray(a.work) ? a.work : [],
      notes: a.notes ?? "",
      fee: fromKobo(a.fee ?? 0),
      storeId: a.locationId,
      staffId: a.staffId,
      tailor: a.tailor,
      createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(a.createdAt).toISOString(),
      readyBy: typeof a.readyBy === "string" ? a.readyBy : new Date(a.readyBy).toISOString(),
      status: a.status as "received" | "with-tailor" | "ready" | "collected",
      collectedAt: a.collectedAt ? (typeof a.collectedAt === "string" ? a.collectedAt : new Date(a.collectedAt).toISOString()) : undefined,
    }));
  },
  alterationStatus: (id: string, status: string) => api(`/alterations/${id}/status`, { method: "POST", body: { status } }),

  adjustStock: (body: { warehouseId: string; variantId: string; delta: number; reason: string }) =>
    api("/stock/adjust", { method: "POST", body }),

  createTransfer: (body: { fromWarehouseId: string; toWarehouseId: string; variantId: string; qty: number; reason?: string }) =>
    api("/transfers", { method: "POST", body }),
  stepTransfer: (id: string, status: string) => api(`/transfers/${id}/step`, { method: "POST", body: { status } }),
  listTransfers: async (warehouseId?: string) => {
    const r = await api<unknown>("/transfers", { query: { page: 1, pageSize: 50, warehouseId } });
    return Array.isArray(r) ? r : [];
  },

  createCount: (body: { warehouseId: string; scope: string; lines: { variantId: string; expected: number; counted: number }[] }) =>
    api("/stock-counts", { method: "POST", body }),
  postCount: (id: string) => api(`/stock-counts/${id}/post`, { method: "POST", body: {} }),
  listCounts: async (warehouseId?: string) => {
    const r = await api<unknown>("/stock-counts", { query: { page: 1, pageSize: 50, warehouseId } });
    return Array.isArray(r) ? r : [];
  },

  createGrn: (body: Record<string, unknown>) => api("/grn", { method: "POST", body }),
  receiveGrn: (id: string, lines: { variantId: string; received: number }[]) =>
    api(`/grn/${id}/receive`, { method: "POST", body: { lines } }),
  listGrn: async (warehouseId?: string) => {
    const r = await api<unknown>("/grn", { query: { page: 1, pageSize: 50, warehouseId } });
    return Array.isArray(r) ? r : [];
  },

  concierge: (body: Record<string, unknown>) => api("/concierge", { method: "POST", body }),

  shippingQuote: (address: Record<string, unknown>, subtotalNaira: number) =>
    api("/sales/shipping-quote", { method: "POST", body: { address, subtotal: toKobo(subtotalNaira) } }),
};

export const adminPosApi = {
  overview: () => api("/overview", { admin: true }),
  transactions: (q?: Record<string, string | number | undefined>) => api("/transactions", { admin: true, query: q }),
  reports: (q?: Record<string, string | undefined>) => api("/reports", { admin: true, query: q }),
  registers: () => api("/registers", { admin: true }),
  upsertRegister: (body: {
    id?: string;
    locationId: string;
    warehouseId: string;
    name: string;
    device?: string;
    printer?: string;
    terminalId?: string;
    drawer?: boolean;
    scanner?: string;
    active?: boolean;
  }) => api("/registers", { admin: true, method: "POST", body }),
  sessions: () => api("/sessions", { admin: true, query: { page: 1, pageSize: 50 } }),
  audit: () => api("/audit", { admin: true, query: { page: 1, pageSize: 100 } }),
  promotions: () => api("/promotions", { admin: true }),
  createPromotion: (body: Record<string, unknown>) => api("/promotions", { admin: true, method: "POST", body }),
  updatePromotion: (id: string, body: Record<string, unknown>) => api(`/promotions/${id}`, { admin: true, method: "PATCH", body }),
  deletePromotion: (id: string) => api(`/promotions/${id}`, { admin: true, method: "DELETE" }),
  giftCards: (q?: string) => api("/gift-cards", { admin: true, query: { page: 1, pageSize: 50, q } }),
  issueGiftCard: (amountNaira: number, opts?: { customerId?: string; locationId?: string }) =>
    api("/gift-cards", { admin: true, method: "POST", body: { amount: toKobo(amountNaira), ...opts } }),
  adjustGiftCard: (code: string, body: { amount: number; note?: string; cancel?: boolean }) =>
    api(`/gift-cards/${encodeURIComponent(code)}/adjust`, { admin: true, method: "POST", body }),
  settings: () => api("/settings", { admin: true }),
  patchSettings: (patch: Record<string, unknown>) => api("/settings", { admin: true, method: "PATCH", body: patch }),
  stockMoves: () => api("/stock-moves", { admin: true }),
  staff: () => api("/staff", { admin: true }),
  upsertStaff: (body: Record<string, unknown>) => api("/staff", { admin: true, method: "POST", body }),
  locations: () => api("/locations", { admin: true }),
  patchLocation: (id: string, body: Record<string, unknown>) => api(`/locations/${id}`, { admin: true, method: "PATCH", body }),
  warehouses: () => api("/warehouses", { admin: true }),
  coupons: () => api("/coupons", { admin: true }),
  patchCouponChannels: (id: string, channels: string[]) =>
    api(`/coupons/${id}`, { admin: true, method: "PATCH", body: { channels } }),
};

/* ---------- shapes ---------- */

type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  price: number;
  compareAt: number | null;
  variants: {
    id: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    price: number;
    stock: { here: number | null };
  }[];
};

type ApiCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tier: string;
  loyaltyPoints: number;
  walletBalance: number;
  spend: number;
  orders: number;
};

type QuoteResult = {
  due: number;
  total: number;
  subtotal: number;
  discountTotal: number;
  vat: number;
  points: number;
  pointsUsed: number;
  coupon: number;
  couponError?: string | null;
  manual: number;
  lineDiscounts?: number;
  promoTotal?: number;
  extras?: number;
  promos?: { id: string; label: string; amount: number }[];
  depositDue?: number | null;
  lines: { gross: number; lineDiscount: number; net: number; promo?: number }[];
  customer?: { id: string; name: string; points: number; tier: string } | null;
};

type SaleResult = {
  id: string;
  number: string;
  total: number;
  subtotal: number;
  discount: number;
  taxIncluded: number;
  changeGiven: number;
  status: string;
  paymentStatus: string;
  placedAt: string;
  customer: { id: string; name: string } | null;
  items: { id: string; variantId: string | null; name: string; brand: string; qty: number; unitPrice: number; lineTotal: number; lineDiscount: number; sku: string | null; size: string | null; color: string | null; imageUrl: string | null }[];
  payments: { method: string; amount: number; reference?: string }[];
  layaway?: { deposit: number; balance: number; until: string; status: string } | null;
  receiptFooter?: string;
};

function mapCustomer(c: ApiCustomer) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ?? "",
    tier: c.tier as "Standard" | "Silver" | "Gold" | "Signature",
    loyaltyPoints: c.loyaltyPoints,
    walletBalance: fromKobo(c.walletBalance),
    spend: fromKobo(typeof c.spend === "number" ? c.spend : Number(c.spend)),
    orders: c.orders,
    joined: new Date().toISOString(),
  };
}

function mapQuote(q: QuoteResult) {
  return {
    ...q,
    due: fromKobo(q.due),
    total: fromKobo(q.total),
    subtotal: fromKobo(q.subtotal),
    discountTotal: fromKobo(q.discountTotal),
    vat: fromKobo(q.vat),
    points: fromKobo(q.points),
    coupon: fromKobo(q.coupon),
    couponError: q.couponError ?? null,
    manual: fromKobo(q.manual),
    lineDiscounts: q.lineDiscounts != null ? fromKobo(q.lineDiscounts) : undefined,
    promoTotal: q.promoTotal != null ? fromKobo(q.promoTotal) : undefined,
    extras: typeof q.extras === "number" ? fromKobo(q.extras) : undefined,
    depositDue: q.depositDue != null ? fromKobo(q.depositDue) : null,
    promos: (q.promos ?? []).map((p) => ({ ...p, amount: fromKobo(p.amount) })),
    lines: q.lines.map((l) => ({
      gross: fromKobo(l.gross),
      lineDiscount: fromKobo(l.lineDiscount),
      promo: l.promo != null ? fromKobo(l.promo) : 0,
      net: fromKobo(l.net),
    })),
  };
}

function mapSale(s: SaleResult) {
  return {
    ...s,
    total: fromKobo(s.total),
    subtotal: fromKobo(s.subtotal),
    discount: fromKobo(s.discount),
    taxIncluded: fromKobo(s.taxIncluded),
    changeGiven: fromKobo(s.changeGiven),
    items: s.items.map((i) => ({
      ...i,
      unitPrice: fromKobo(i.unitPrice),
      lineTotal: fromKobo(i.lineTotal),
      lineDiscount: fromKobo(i.lineDiscount),
    })),
    payments: s.payments.map((p) => ({ ...p, amount: fromKobo(p.amount) })),
    layaway: s.layaway
      ? {
          ...s.layaway,
          deposit: fromKobo(s.layaway.deposit),
          balance: fromKobo(s.layaway.balance),
          until: typeof s.layaway.until === "string" ? s.layaway.until : new Date(s.layaway.until).toISOString(),
        }
      : null,
  };
}

function cartToQuoteBody(cart: Cart, fulfilment: "instore" | "ship" | "layaway") {
  const regId = typeof localStorage !== "undefined" ? localStorage.getItem("asl-pos-register") : null;
  const locationId = regId ? useDb.getState().registers.find((r) => r.id === regId)?.storeId : undefined;
  return {
    lines: cart.lines.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      unitPrice: toKobo(l.unitPrice),
      discount: toKoboDisc(l.discount as Disc | undefined),
      soldById: l.soldBy ?? cart.associateId,
    })),
    customerId: cart.customerId,
    couponCode: cart.couponCode,
    manual: toKoboDisc(cart.manual),
    pointsToUse: cart.pointsToUse,
    fulfilment: cart.delivery && cart.lines.some((l) => l.shipFrom) ? "ship" : fulfilment,
    locationId,
    extras: [
      ...(cart.giftCards ?? []).map((g) => ({ kind: "giftcard" as const, label: "Gift card", amount: toKobo(g.amount) })),
      ...(cart.alterations ?? []).filter((a) => a.fee > 0).map((a) => ({ kind: "alteration" as const, label: a.item, amount: toKobo(a.fee) })),
      ...(cart.delivery ? [{ kind: "delivery" as const, label: cart.delivery.zone, amount: toKobo(cart.delivery.fee) }] : []),
    ],
  };
}

export type { CatalogProduct };
