import { create } from "zustand";
import { persist } from "zustand/middleware";
import { orderNo, COUPONS, CUSTOMERS, CUSTOMER_EXTRAS, DEFAULT_SETTINGS, GIFT_CARDS, PROMOTIONS, REGISTERS, STAFF, STORES, buildCatalogue, buildHistory, buildServices, label } from "./seed";
import type { Activity, Alteration, AuditEvent, ConciergeRequest, Customer, Delivery, GiftCard, Order, OrderLine, Product, Promotion, Register, Session, Settings, Staff, StockCount, Store, Transfer, Variant } from "./types";
import type { Disc } from "../lib/pricing";

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Shared "backend" data. The admin and every till read and write this. */
/* In the prototype it lives in the browser and syncs between tabs.    */
/* ------------------------------------------------------------------ */

/** A reservation and a ship-to-customer order so those lists aren't empty on first open. */
function sampleServiceOrders(products: Product[], seq: number): Order[] {
  const line = (pid: string, vi: number, soldBy: string, shipFrom?: string): OrderLine => {
    const p = products.find((x) => x.id === pid)!;
    const v = p.variants[vi];
    return { productId: p.id, variantId: v.id, name: p.name, brand: p.brand, image: p.image, variantLabel: label(v), sku: v.sku, qty: 1, unitPrice: p.price, lineDiscount: 0, net: p.price, returnedQty: 0, soldBy, shipFrom };
  };
  const at = (d: number) => new Date(Date.now() - d * 86400e3).toISOString();
  const base = { channel: "pos" as const, storeId: "LOC-1001", registerId: "r1", discountTotal: 0, pointsRedeemed: 0, change: 0, returns: [], pointsEarned: 0, synced: true };
  const res = line("f10", 2, "s3");
  const ship = line("f8", 3, "s2", "lag");
  return [
    { ...base, id: "o-res1", number: orderNo(seq - 3), staffId: "s3", customerId: CUSTOMERS[2].id, customerName: CUSTOMERS[2].name, lines: [res], subtotal: res.net, total: res.net, vat: Math.round((res.net * 7.5) / 107.5), payments: [{ method: "transfer", amount: 225000, reference: CUSTOMERS[2].name }], status: "reserved", fulfilment: "instore", createdAt: at(4), reservation: { deposit: 225000, balance: res.net - 225000, until: new Date(Date.now() + 17 * 86400e3).toISOString(), status: "open" } },
    { ...base, id: "o-del1", number: orderNo(seq - 2), staffId: "s2", customerId: CUSTOMERS[1].id, customerName: CUSTOMERS[1].name, lines: [ship], subtotal: ship.net, total: ship.net + 4500, vat: Math.round(((ship.net + 4500) * 7.5) / 107.5), payments: [{ method: "card", amount: ship.net + 4500, reference: "884201" }], status: "completed", fulfilment: "delivery", createdAt: at(1), extras: [{ kind: "delivery", label: "Delivery · Lagos Metro · same day", amount: 4500 }], delivery: { name: CUSTOMERS[1].name, phone: CUSTOMERS[1].phone, address: "22 Bourdillon Road, Ikoyi", city: "Lagos", zone: "Lagos Metro · same day", fee: 4500, fromStoreId: "lag", status: "dispatched", eta: new Date(Date.now() + 0.5 * 86400e3).toISOString() } },
  ];
}

function initial() {
  const { products, inventory } = buildCatalogue();
  const { orders, sessions, seq } = buildHistory(products);
  const services = buildServices(products);
  return {
    products,
    inventory,
    stores: STORES,
    registers: REGISTERS,
    staff: STAFF,
    customers: CUSTOMERS.map((c) => ({ ...c, ...CUSTOMER_EXTRAS[c.id] })),
    coupons: COUPONS,
    promotions: PROMOTIONS,
    giftCards: GIFT_CARDS,
    alterations: services.alterations,
    deliveries: services.deliveries,
    counts: services.counts,
    auditLog: services.audit,
    conciergeRequests: [] as ConciergeRequest[],
    orders: [...sampleServiceOrders(products, seq), ...orders],
    sessions,
    settings: DEFAULT_SETTINGS,
    transfers: services.transfers,
    activity: [
      { id: uid(), at: new Date(Date.now() - 6 * 60e3).toISOString(), text: "Ikeja Till 1 synced 3 sales", kind: "sync" },
      { id: uid(), at: new Date(Date.now() - 22 * 60e3).toISOString(), text: "Website order ready for pickup at Lekki Flagship", kind: "online" },
    ] as Activity[],
    seq,
  };
}

type Data = ReturnType<typeof initial>;

type SettingsKey = keyof Settings;

interface DbState extends Data {
  setSettings<K extends SettingsKey>(key: K, patch: Partial<Settings[K]>): void;
  log(text: string, kind: Activity["kind"]): void;
  nextNumber(): string;
  addOrder(o: Order): void;
  patchOrder(id: string, patch: Partial<Order>): void;
  moveStock(variantId: string, storeId: string, delta: number): void;
  upsertStaff(s: Staff): void;
  upsertStore(s: Store): void;
  upsertRegister(r: Register): void;
  removeRegister(id: string): void;
  addCustomer(c: Pick<Customer, "name" | "phone" | "email">): Customer;
  patchCustomer(id: string, patch: Partial<Customer>): void;
  addSession(s: Session): void;
  patchSession(id: string, patch: Partial<Session>): void;
  addTransfer(t: Omit<Transfer, "number" | "steps">): Transfer;
  /** Moves a transfer on a step. Stock leaves the sender when it ships and arrives when received. */
  stepTransfer(id: string, status: Transfer["status"], by: string): void;
  patchProduct(id: string, patch: Partial<Product>): void;
  upsertPromotion(p: Promotion): void;
  removePromotion(id: string): void;
  upsertGiftCard(g: GiftCard): void;
  addAlteration(a: Omit<Alteration, "id" | "number">): Alteration;
  patchAlteration(id: string, patch: Partial<Alteration>): void;
  patchDelivery(id: string, patch: Partial<Delivery>): void;
  addCount(c: Omit<StockCount, "id" | "number">): StockCount;
  addConciergeRequest(r: Omit<ConciergeRequest, "id">): ConciergeRequest;
  audit(e: Omit<AuditEvent, "id" | "at">): void;
  simulateOnlineOrder(storeId: string): Order;
  reset(): void;
}

export const useDb = create<DbState>()(
  persist(
    (set, get) => ({
      ...initial(),
      setSettings: (key, patch) => set({ settings: { ...get().settings, [key]: { ...get().settings[key], ...patch } } }),
      log: (text, kind) => set({ activity: [{ id: uid(), at: new Date().toISOString(), text, kind }, ...get().activity].slice(0, 60) }),
      nextNumber: () => {
        const seq = get().seq + 1;
        set({ seq });
        return orderNo(seq);
      },
      addOrder: (o) => set({ orders: [o, ...get().orders] }),
      patchOrder: (id, patch) => set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
      moveStock: (variantId, storeId, delta) => {
        const inv = get().inventory;
        set({ inventory: { ...inv, [variantId]: { ...inv[variantId], [storeId]: Math.max(0, (inv[variantId]?.[storeId] ?? 0) + delta) } } });
      },
      upsertStaff: (s) => set({ staff: get().staff.some((x) => x.id === s.id) ? get().staff.map((x) => (x.id === s.id ? s : x)) : [...get().staff, s] }),
      upsertStore: (s) => set({ stores: get().stores.some((x) => x.id === s.id) ? get().stores.map((x) => (x.id === s.id ? s : x)) : [...get().stores, s] }),
      upsertRegister: (r) => set({ registers: get().registers.some((x) => x.id === r.id) ? get().registers.map((x) => (x.id === r.id ? r : x)) : [...get().registers, r] }),
      removeRegister: (id) => set({ registers: get().registers.filter((r) => r.id !== id) }),
      addCustomer: (c) => {
        const customer: Customer = { ...c, id: uid(), joined: new Date().toISOString(), spend: 0, orders: 0, loyaltyPoints: 0, walletBalance: 0, tier: "Standard" };
        set({ customers: [customer, ...get().customers] });
        return customer;
      },
      patchCustomer: (id, patch) => set({ customers: get().customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
      addSession: (s) => set({ sessions: [s, ...get().sessions] }),
      patchSession: (id, patch) => set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      addTransfer: (t) => {
        const n = Math.max(500, ...get().transfers.map((x) => Number(x.number.slice(3)) || 0)) + 1;
        const tr: Transfer = { ...t, number: `TR-${n}`, steps: [{ status: "requested", at: t.at, by: t.requestedBy }] };
        set({ transfers: [tr, ...get().transfers] });
        return tr;
      },
      stepTransfer: (id, status, by) => {
        const t = get().transfers.find((x) => x.id === id);
        if (!t) return;
        if (status === "in-transit") get().moveStock(t.variantId, t.fromStoreId, -t.qty);
        if (status === "received") get().moveStock(t.variantId, t.toStoreId, t.qty);
        set({ transfers: get().transfers.map((x) => (x.id === id ? { ...x, status, steps: [...x.steps, { status, at: new Date().toISOString(), by }] } : x)) });
      },
      patchProduct: (id, patch) => set({ products: get().products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      upsertPromotion: (p) => set({ promotions: get().promotions.some((x) => x.id === p.id) ? get().promotions.map((x) => (x.id === p.id ? p : x)) : [p, ...get().promotions] }),
      removePromotion: (id) => set({ promotions: get().promotions.filter((p) => p.id !== id) }),
      upsertGiftCard: (g) => set({ giftCards: get().giftCards.some((x) => x.code === g.code) ? get().giftCards.map((x) => (x.code === g.code ? g : x)) : [g, ...get().giftCards] }),
      addConciergeRequest: (r) => {
        const n = Math.max(421, ...get().conciergeRequests.map((x) => Number(x.id.slice(8)) || 0)) + 1;
        const req: ConciergeRequest = { ...r, id: `ASL-REQ-${String(n).padStart(5, "0")}` };
        set({ conciergeRequests: [req, ...get().conciergeRequests] });
        return req;
      },
      addAlteration: (a) => {
        const n = Math.max(2040, ...get().alterations.map((x) => Number(x.number.slice(4)) || 0)) + 1;
        const alt: Alteration = { ...a, id: uid(), number: `ALT-${n}` };
        set({ alterations: [alt, ...get().alterations] });
        return alt;
      },
      patchAlteration: (id, patch) => set({ alterations: get().alterations.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
      patchDelivery: (id, patch) => set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, ...patch } : d)) }),
      addCount: (c) => {
        const n = Math.max(88, ...get().counts.map((x) => Number(x.number.slice(3)) || 0)) + 1;
        const count: StockCount = { ...c, id: uid(), number: `SC-${n}` };
        set({ counts: [count, ...get().counts] });
        return count;
      },
      audit: (e) => set({ auditLog: [{ ...e, id: uid(), at: new Date().toISOString() }, ...get().auditLog].slice(0, 400) }),
      simulateOnlineOrder: (storeId) => {
        const s = get();
        const inStock = s.products.flatMap((p) => p.variants.map((v) => ({ p, v }))).filter(({ v }) => (s.inventory[v.id]?.warehouse ?? 0) > 0);
        const pick = inStock[Math.floor(Math.random() * inStock.length)];
        const cust = s.customers[Math.floor(Math.random() * s.customers.length)];
        const total = pick.p.price;
        const order: Order = {
          id: uid(),
          number: get().nextNumber(),
          channel: Math.random() < 0.6 ? "web" : "app",
          customerId: cust.id,
          customerName: cust.name,
          lines: [{ productId: pick.p.id, variantId: pick.v.id, name: pick.p.name, brand: pick.p.brand, image: pick.p.image, variantLabel: label(pick.v), sku: pick.v.sku, qty: 1, unitPrice: total, lineDiscount: 0, net: total, returnedQty: 0 }],
          subtotal: total,
          discountTotal: 0,
          pointsRedeemed: 0,
          total,
          vat: Math.round((total * 7.5) / 107.5),
          payments: [{ method: "card", amount: total, reference: `PSK-${Math.floor(Math.random() * 900000 + 100000)}` }],
          change: 0,
          status: "processing",
          fulfilment: "pickup",
          pickupStoreId: storeId,
          pickupCode: String(Math.floor(Math.random() * 900000 + 100000)),
          createdAt: new Date().toISOString(),
          returns: [],
          pointsEarned: Math.floor(total / 1000),
          synced: true,
        };
        set({ orders: [order, ...get().orders] });
        get().log(`New ${order.channel === "web" ? "website" : "app"} order ${order.number} for pickup at ${s.stores.find((x) => x.id === storeId)?.name}`, "online");
        return order;
      },
      reset: () => set({ ...initial() }),
    }),
    { name: "asl-pos-db", version: 5 },
  ),
);

// Keep tabs in step: the admin open in one tab and the till in another see each other's changes.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "asl-pos-db") useDb.persist.rehydrate();
  });
}

export function findVariant(products: Product[], variantId: string): { product: Product; variant: Variant } | undefined {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
}

/* ------------------------------------------------------------------ */
/* Till state: this device only.                                       */
/* ------------------------------------------------------------------ */

export interface CartLine {
  key: string;
  productId: string;
  variantId: string;
  qty: number;
  unitPrice: number;
  listPrice: number;
  discount?: Disc;
  overrideBy?: string;
  note?: string;
  /** Sales associate for this line, when it differs from the sale's. */
  soldBy?: string;
  /** Ship to the customer from this location instead of handing over now. */
  shipFrom?: string;
}

/** An alteration booked on this sale; becomes a ticket when the sale completes. */
export interface AlterationDraft {
  key: string;
  item: string;
  work: string[];
  notes: string;
  fee: number;
  tailor: string;
  readyBy: string;
}

export interface DeliveryDraft {
  name: string;
  phone: string;
  address: string;
  city: string;
  zone: string;
  fee: number;
}

export interface ExchangeDraft {
  orderId: string;
  number: string;
  credit: number;
  reason: string;
  lines: { lineIndex: number; qty: number; restock: boolean }[];
  approvedBy?: string;
}

export interface Cart {
  lines: CartLine[];
  customerId?: string;
  couponCode?: string;
  manual?: Disc;
  pointsToUse: number;
  note?: string;
  exchange?: ExchangeDraft;
  /** Who gets the sales credit; defaults to whoever is signed in. */
  associateId?: string;
  giftCards?: { key: string; amount: number }[];
  alterations?: AlterationDraft[];
  delivery?: DeliveryDraft;
}

export interface Held {
  id: string;
  at: string;
  label: string;
  cart: Cart;
  staffId: string;
}

export const emptyCart = (): Cart => ({ lines: [], pointsToUse: 0 });

interface TillState {
  registerId: string;
  staffId: string | null;
  sessionId: string | null;
  cart: Cart;
  held: Held[];
  offline: boolean;
  lastSync: string;
  set(patch: Partial<Omit<TillState, "set" | "patchCart">>): void;
  patchCart(patch: Partial<Cart>): void;
}

export const useTill = create<TillState>()(
  persist(
    (set, get) => ({
      registerId: "r1",
      staffId: null,
      sessionId: null,
      cart: emptyCart(),
      held: [],
      offline: false,
      lastSync: new Date().toISOString(),
      set: (patch) => set(patch),
      patchCart: (patch) => set({ cart: { ...get().cart, ...patch } }),
    }),
    { name: "asl-pos-till", version: 5 },
  ),
);

