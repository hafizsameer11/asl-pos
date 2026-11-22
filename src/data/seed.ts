import type { Alteration, AuditEvent, Category, Coupon, Customer, Delivery, GiftCard, Order, OrderLine, Product, Promotion, Register, Session, Settings, Staff, StockCount, Store, Tier, Transfer, Variant } from "./types";
import { CATALOG } from "./catalog";

/**
 * Sample data for the prototype, lined up with the ASL ORIGINALS website, app and admin prototype:
 * the same products, boutiques, customers (cus_1000…), ASL Club tiers and coupon codes.
 * Everything here would come from the store's backend.
 */

function rand(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function ean13(n: number) {
  const body = String(615100000000 + n);
  const sum = [...body].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + String((10 - (sum % 10)) % 10);
}

/**
 * The boutiques are the admin's pickup locations (pickups-store.ts, LOC-1001…1003), so a website order
 * collected in store and a till sale point at the same place. "lag" is the inventory warehouse
 * Lagos Flagship DC (inventory-store.ts) that ships online orders.
 */
export const STORES: Store[] = [
  { id: "LOC-1001", name: "ASL Ikoyi Flagship", address: "12A Bourdillon Road, Ikoyi, Lagos", phone: "+234 800 000 0011", hours: "Mon - Sat 10:00 - 20:00 · Sun 12:00 - 18:00", kind: "store", sellsInPerson: true },
  { id: "LOC-1002", name: "ASL Lekki Lounge", address: "Plot 7, Admiralty Way, Lekki Phase 1, Lagos", phone: "+234 800 000 0022", hours: "Mon - Sun 11:00 - 21:00", kind: "store", sellsInPerson: true },
  { id: "LOC-1003", name: "ASL Abuja Salon (Maitama)", address: "18 Gana Street, Maitama, FCT", phone: "+234 800 000 0033", hours: "Mon - Sat 10:00 - 19:00", kind: "store", sellsInPerson: true },
  { id: "lag", name: "Lagos Flagship DC", address: "LAG-01 · Lagos", phone: "+234 800 275 0000", hours: "Mon - Fri 08:00 - 17:00", kind: "warehouse", sellsInPerson: false },
];

/** SKU as the admin Inventory page builds it: product id + size, e.g. F1-42, A1-ONESIZE. */
export const skuFor = (productId: string, size: string) => `${productId.toUpperCase()}-${size.replace(/\s+/g, "").toUpperCase()}`;

export function buildCatalogue() {
  const products: Product[] = [];
  const inventory: Record<string, Record<string, number>> = {};
  let n = 0;
  for (const item of CATALOG) {
    const variants: Variant[] = [];
    for (const size of item.sizes) {
      n += 1;
      const id = `v${n}`;
      variants.push({ id, sku: skuFor(item.id, size), barcode: ean13(n), colour: item.colour.name, size });
      inventory[id] = Object.fromEntries(
        STORES.map((s, k) => {
          const r = rand(n * 7 + k);
          let qty = s.kind === "warehouse" ? Math.floor(r * 18) : r < 0.14 ? 0 : r < 0.32 ? 1 + Math.floor(r * 5) : 2 + Math.floor(r * 9);
          if (item.availability === "Limited Pieces") qty = Math.min(qty, r < 0.5 ? 1 : 2);
          if (item.soldOut || item.availability === "Pre Order") qty = 0;
          return [s.id, qty];
        }),
      );
    }
    products.push({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      image: item.image,
      price: item.price,
      compareAt: item.compareAt,
      description: item.description,
      availability: item.availability,
      priceOnRequest: item.priceOnRequest,
      sizeLabels: item.sizeLabels,
      colours: [item.colour],
      sizes: item.sizes,
      variants,
    });
  }
  return { products, inventory };
}

/**
 * Store staff sign in to the till with a PIN. They sit next to the admin team (team-store.ts)
 * as new store roles: see docs/INTEGRATION.md.
 */
export const STAFF: Staff[] = [
  { id: "s1", name: "Temi Bakare", email: "temi.bakare@asloriginals.com", role: "Manager", pin: "1234", storeIds: ["LOC-1001", "LOC-1002", "LOC-1003"], active: true },
  { id: "s2", name: "Chidi Okafor", email: "chidi.okafor@asloriginals.com", role: "Supervisor", pin: "2468", storeIds: ["LOC-1001"], active: true },
  { id: "s3", name: "Halima Musa", email: "halima.musa@asloriginals.com", role: "Cashier", pin: "1111", storeIds: ["LOC-1001"], active: true },
  { id: "s4", name: "Dayo Adeleke", email: "dayo.adeleke@asloriginals.com", role: "Cashier", pin: "2222", storeIds: ["LOC-1002"], active: true },
  { id: "s5", name: "Bisi Okoro", email: "bisi.okoro@asloriginals.com", role: "Supervisor", pin: "3333", storeIds: ["LOC-1002", "LOC-1003"], active: true },
  { id: "s6", name: "Musa Garba", email: "musa.garba@asloriginals.com", role: "Cashier", pin: "4444", storeIds: ["LOC-1003"], active: false },
];

const now = () => new Date().toISOString();

export const REGISTERS: Register[] = [
  { id: "r1", name: "Till 1", storeId: "LOC-1001", device: "iPad Pro 11 · Front desk", printer: "Epson TM-m30III", terminalId: "TID 2033 4410", drawer: true, scanner: "Zebra DS2208", online: true, lastSeen: now() },
  { id: "r2", name: "Till 2", storeId: "LOC-1001", device: "Galaxy Tab S9 · Fitting rooms", printer: "Star mC-Print3", terminalId: "TID 2033 4411", drawer: false, scanner: "Camera", online: false, lastSeen: new Date(Date.now() - 3 * 3600e3).toISOString() },
  { id: "r3", name: "Till 1", storeId: "LOC-1002", device: "iPad 10th gen", printer: "Epson TM-m30III", terminalId: "TID 2033 5520", drawer: true, scanner: "Zebra DS2208", online: true, lastSeen: now() },
  { id: "r4", name: "Till 1", storeId: "LOC-1003", device: "Galaxy Tab S9", printer: "Epson TM-m30III", terminalId: "TID 2033 6630", drawer: true, scanner: "Honeywell Voyager 1250g", online: true, lastSeen: now() },
];

/** ASL Club tier from lifetime spend, as customers-store.ts and club-store.ts work it out. */
export const CLUB_MIN_SPEND: Record<Tier, number> = { Standard: 0, Silver: 500_000, Gold: 1_500_000, Signature: 3_500_000 };
export function tierFor(spend: number, minSpend: Record<Tier, number> = CLUB_MIN_SPEND): Tier {
  return spend >= minSpend.Signature ? "Signature" : spend >= minSpend.Gold ? "Gold" : spend >= minSpend.Silver ? "Silver" : "Standard";
}

/** Tier perks, word for word from the ASL Club page (club-store.ts DEFAULT_TIERS). */
export const CLUB_PERKS: Record<Tier, string[]> = {
  Standard: ["Earn 1 point per ₦1,000 spent", "Access to member-only drops"],
  Silver: ["1.25× points", "Free standard shipping over ₦100k", "Early sale access (24h)"],
  Gold: ["1.75× points", "Free express shipping", "Priority concierge queue", "Birthday gift box"],
  Signature: ["3× points on every order", "Dedicated concierge line", "Complimentary global shipping", "Invitations to private ASL events", "First access to limited pieces"],
};

/**
 * The admin's 42 customers (customers-store.ts seedCustomers), generated the same way so the ids,
 * names, tiers, wallet balances and points match what the admin shows.
 */
function adminCustomers(): Customer[] {
  const FIRST = ["Adaeze", "Chike", "Ifeoma", "Tunde", "Ngozi", "Bola", "Kola", "Amaka", "Uche", "Femi", "Aisha", "Sade", "Emeka", "Zainab", "Yemi", "Kunle", "Chidera", "Obinna", "Halima", "Ibrahim", "Fola", "Ronke", "Damilola", "Segun", "Kemi", "Ada", "Nkechi", "Bayo"];
  const LAST = ["Okafor", "Bello", "Adeyemi", "Balogun", "Eze", "Obi", "Adegoke", "Nwosu", "Musa", "Lawal", "Ogundipe", "Ilori", "Oduya", "Ademola", "Chukwu", "Ojo", "Sanni", "Umeh", "Alabi", "Ige", "Fashola", "Ibrahim"];
  const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Kano", "Benin City", "Uyo", "London", "Accra", "Dubai"];
  const TAGS = ["watches", "sneakers", "fragrance", "concierge", "fashion", "gifting", "corporate"];
  const pick = <T,>(a: T[], i: number) => a[i % a.length];
  const r = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const list: Customer[] = [];
  for (let i = 0; i < 42; i++) {
    const first = pick(FIRST, i * 3 + 1);
    const last = pick(LAST, i * 5 + 2);
    const orders = Math.max(0, Math.floor(r(i + 1) * 18));
    const concierge = Math.floor(r(i + 5) * 4);
    const spend = Math.round((orders * (60_000 + Math.floor(r(i + 9) * 350_000)) + concierge * 850_000) / 1000) * 1000;
    const created = new Date(Date.now() - (60 + Math.floor(r(i + 11) * 720)) * 86400000);
    list.push({
      id: `cus_${1000 + i}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + "@example.com",
      phone: `+234 ${800 + (i % 90)} ${String(1000000 + i * 137).slice(0, 7)}`,
      city: pick(CITIES, i + 7),
      tier: tierFor(spend),
      orders,
      spend,
      walletBalance: Math.round((r(i + 3) * 250_000) / 500) * 500,
      loyaltyPoints: Math.floor(spend / 1000),
      joined: created.toISOString(),
      tags: [pick(TAGS, i), pick(TAGS, i + 3)].filter((v, ix, a) => a.indexOf(v) === ix),
    });
  }
  return list;
}

export const CUSTOMERS: Customer[] = adminCustomers();

/** The demo customer: the highest spender, given a birthday this month, a gift card, saved sizes and an app wishlist. */
export const DEMO_CUSTOMER = [...CUSTOMERS].sort((a, b) => b.spend - a.spend)[0].id;
for (const [i, c] of CUSTOMERS.entries()) {
  if (c.id === DEMO_CUSTOMER) {
    c.birthday = `${String(new Date().getMonth() + 1).padStart(2, "0")}-21`;
    c.note = "Signature client. Prefers WhatsApp updates. Call before new AMIRI and Nike drops.";
  } else if (i % 5 === 3) c.birthday = `${String(1 + (i % 12)).padStart(2, "0")}-14`;
}

/**
 * The admin's coupons (coupons-store.ts), same codes and rules. The admin's channels are web, mobile and concierge;
 * the POS adds "store", which is what makes a code work at the till.
 */
export const COUPONS: Coupon[] = [
  { code: "WELCOME10", label: "10% off first order", type: "percent", value: 10, minSpend: 50000, maxDiscount: 25000, active: true, channels: ["web", "mobile", "store"], expires: "2026-12-31" },
  { code: "VIP25", label: "25% off for VIP / Signature", type: "percent", value: 25, minSpend: 0, maxDiscount: 200000, active: true, channels: ["web", "mobile", "store"], expires: "2026-12-31" },
  { code: "SNEAKER15", label: "15% off sneakers", type: "percent", value: 15, minSpend: 100000, active: true, channels: ["web", "mobile"], expires: "2026-12-31" },
  { code: "CONCIERGE10", label: "10% off concierge", type: "percent", value: 10, minSpend: 0, maxDiscount: 100000, active: true, channels: ["concierge"], expires: "2026-12-31" },
  { code: "LOEWE5K", label: "₦5,000 off ₦80,000+", type: "fixed", value: 5000, minSpend: 80000, active: false, channels: ["web", "mobile", "store"], expires: "2027-03-31" },
  { code: "RAMADAN30", label: "Ramadan 30%", type: "percent", value: 30, minSpend: 0, maxDiscount: 150000, active: false, channels: ["web", "mobile"], expires: "2026-04-01" },
];

export const DEFAULT_SETTINGS: Settings = {
  general: { posEnabled: true, vatRate: 7.5, pricesIncludeVat: true, cashRounding: 0, requireCustomerOver: 0 },
  payments: {
    cash: true,
    card: true,
    transfer: true,
    wallet: true,
    points: true,
    split: true,
    quickTender: [5000, 10000, 20000, 50000, 100000],
    cardProvider: "Moniepoint",
    transferAccounts: [{ bank: "GTBank", name: "ASL ORIGINALS Ltd", number: "0123456789" }],
    transferNeedsRef: true,
  },
  discounts: {
    limits: { Cashier: 10, Supervisor: 25, Manager: 100 },
    requireReason: true,
    reasons: ["Loyal customer", "Staff purchase", "Damaged item", "Price match", "Manager goodwill"],
    couponsAtPos: true,
    stackCoupons: false,
  },
  receipts: {
    header: "Thank you for shopping with ASL ORIGINALS",
    footer: "Premium style. Original always. · asloriginals.com",
    showVat: true,
    showLoyalty: true,
    showPolicy: true,
    showQr: true,
    showStaff: true,
    giftReceipts: true,
    channels: { print: true, email: true, sms: true, whatsapp: true },
    paper: "80mm",
  },
  returns: {
    windowDays: 7,
    requireReceipt: true,
    approvalOver: 250000,
    toOriginal: true,
    toCredit: true,
    toCash: true,
    restockDefault: true,
    exchanges: true,
    onlineOrdersInStore: true,
    // The admin Returns page reasons (Returns.tsx), minus the delivery-only ones.
    reasons: ["Size too small", "Size too big", "Changed mind", "Faulty or damaged", "Doesn't match description", "Authenticity concern", "Gift return"],
    // Not returnable on the website either (returnsInnerData.ts).
    finalSale: ["Fragrances", "Underwear", "Swim Shorts"],
  },
  cash: {
    defaultFloat: 50000,
    blindClose: false,
    tolerance: 1000,
    denominations: [1000, 500, 200, 100, 50, 20, 10, 5],
    inReasons: ["Float top-up", "Change from bank"],
    outReasons: ["Bank deposit", "Petty cash", "Supplier payment", "Change to bank"],
  },
  // ASL Club rules from the admin (club-store.ts DEFAULT_RULES and DEFAULT_TIERS). minRedeem matches the cheapest club reward (400 pts = ₦10,000 credit).
  loyalty: { earnAtPos: true, redeemAtPos: true, pointValue: 25, earnPer: 1000, minRedeem: 400, multipliers: { Standard: 1, Silver: 1.25, Gold: 1.75, Signature: 3 }, minSpend: CLUB_MIN_SPEND, birthdayBonus: 500 },
  offline: { allowed: true, maxSale: 1500000, syncSeconds: 30, oversell: "warn", pickupsOffline: false },
  roles: {
    Cashier: { discount: true, priceOverride: false, refund: false, refundNoReceipt: false, voidSale: false, cashMoves: false, openClose: true, stockAdjust: false, viewReports: false },
    Supervisor: { discount: true, priceOverride: true, refund: true, refundNoReceipt: false, voidSale: true, cashMoves: true, openClose: true, stockAdjust: true, viewReports: true },
    Manager: { discount: true, priceOverride: true, refund: true, refundNoReceipt: true, voidSale: true, cashMoves: true, openClose: true, stockAdjust: true, viewReports: true },
  },
  services: {
    layaway: true,
    // Same as a drop reservation on the website (coming-soon.ts DEPOSIT_RATE 0.5).
    minDepositPct: 50,
    holdDays: 21,
    cancelRefund: "wallet",
    alterations: true,
    alterationMenu: [
      { name: "Hem jeans or trousers", price: 8000 },
      { name: "Taper legs", price: 12000 },
      { name: "Take in waist", price: 12000 },
      { name: "Shorten sleeves", price: 10000 },
      { name: "Crop a hoodie or tee", price: 9000 },
      { name: "Full fitting", price: 35000 },
    ],
    freeAlterationsOver: 300000,
    tailors: ["In-house · Ikoyi", "Bayo Tailoring, Yaba"],
    turnaroundDays: 4,
    delivery: true,
    // The admin's shipping zones (shipping-zones-store.ts ZN-1001, ZN-1002).
    zones: [
      { name: "Lagos Metro · same day", fee: 4500, days: 1 },
      { name: "Lagos Metro · standard", fee: 2500, days: 2 },
      { name: "Nigeria · DHL Express", fee: 8500, days: 2 },
      { name: "Nigeria · standard", fee: 3500, days: 4 },
    ],
    freeDeliveryOver: 200000,
    giftCards: true,
    giftCardPresets: [25000, 50000, 100000, 250000],
    // The website FAQ: gift cards are valid for 1 year.
    giftCardExpiryMonths: 12,
  },
  commission: { enabled: true, rates: { Cashier: 1, Supervisor: 1.5, Manager: 0 }, targets: { s2: 9000000, s3: 6000000, s4: 6000000, s5: 7000000 }, attributeBy: "associate" },
};

const days = (n: number) => new Date(Date.now() + n * 86400e3).toISOString();

export const PROMOTIONS: Promotion[] = [
  { id: "pr1", name: "Accessories: buy 2, get 1 free", label: "Accessories 3 for 2", kind: "bxgy", buy: 2, get: 1, value: 0, scope: { type: "category", value: "Accessories" }, channels: ["pos", "web", "app"], stores: [], starts: days(-10), ends: days(20), active: true },
  { id: "pr2", name: "AMIRI week in Lagos", label: "AMIRI 10% off", kind: "percent", value: 10, scope: { type: "brand", value: "AMIRI" }, channels: ["pos"], stores: ["LOC-1001", "LOC-1002"], starts: days(-2), ends: days(5), active: true },
  { id: "pr3", name: "Spend ₦400k on fragrance, save ₦40k", label: "Fragrance: ₦40k off ₦400k", kind: "spend", value: 40000, minSpend: 400000, scope: { type: "category", value: "Fragrances" }, channels: ["pos", "web", "app"], stores: [], starts: days(-5), ends: days(25), active: true },
  { id: "pr4", name: "ASL Club birthday month", label: "Birthday 10% off", kind: "birthday", value: 10, scope: { type: "all" }, channels: ["pos", "web", "app"], stores: [], starts: days(-200), ends: days(165), active: true },
  { id: "pr5", name: "Black Friday preview", label: "Black Friday 20%", kind: "percent", value: 20, scope: { type: "all" }, channels: ["pos", "web", "app"], stores: [], starts: days(9), ends: days(12), active: true },
  { id: "pr6", name: "Sneaker week", label: "Footwear 15% off", kind: "percent", value: 15, scope: { type: "category", value: "Footwear" }, channels: ["pos"], stores: [], starts: days(-230), ends: days(-215), active: false },
];

const gc = (code: string, initial: number, balance: number, ago: number, customerId?: string, storeId = "LOC-1001"): GiftCard => ({
  code,
  initial,
  balance,
  issuedAt: days(-ago),
  storeId,
  customerId,
  expires: days(365 - ago),
  status: balance === 0 ? "used" : "active",
  history: [
    { at: days(-ago), amount: initial, kind: "issued", ref: `ASL-ORD-0${19900 + ago}` },
    ...(balance < initial ? [{ at: days(-Math.floor(ago / 2)), amount: -(initial - balance), kind: "redeemed" as const, ref: `ASL-ORD-0${19950 + ago}` }] : []),
  ],
});

const cid = (i: number) => CUSTOMERS[i].id;
const others = CUSTOMERS.filter((c) => c.id !== DEMO_CUSTOMER);

export const GIFT_CARDS: GiftCard[] = [
  gc("GC-4821-7730", 100000, 100000, 3, others[2].id),
  gc("GC-1937-2286", 250000, 85000, 40, DEMO_CUSTOMER),
  gc("GC-6604-1158", 50000, 50000, 12, undefined, "LOC-1002"),
  gc("GC-3075-9942", 25000, 0, 90, others[7].id),
  gc("GC-8812-0461", 100000, 62000, 25, others[4].id, "LOC-1003"),
];

/**
 * Saved sizes and app wishlists for a few customers so clienteling has something to show.
 * Wishlists use the app's wishlist (wishlist.ts: product ids, with the size picked if any).
 */
export const CUSTOMER_EXTRAS: Record<string, Pick<Customer, "sizes" | "wishlist">> = {
  [DEMO_CUSTOMER]: { sizes: { top: "M", bottom: "32", shoe: "43" }, wishlist: ["f8", "a3", "fr3", "c6"] },
  [others[0].id]: { sizes: { top: "L", bottom: "34", shoe: "44" }, wishlist: ["f10", "a9", "c2"] },
  [others[1].id]: { sizes: { top: "S", shoe: "40" }, wishlist: ["fr13", "tr6", "f6"] },
  [others[2].id]: { sizes: { top: "XL", bottom: "36", shoe: "45" }, wishlist: ["f1", "c4"] },
  [others[3].id]: { sizes: { top: "M", shoe: "42" }, wishlist: ["fr8", "a4"] },
};

export function buildServices(products: Product[]) {
  const v = (pid: string, i = 0) => products.find((p) => p.id === pid)!.variants[i].id;
  const demo = CUSTOMERS.find((c) => c.id === DEMO_CUSTOMER)!;
  const o = others;
  const alterations: Alteration[] = [
    { id: "al1", number: "ALT-2041", customerId: demo.id, customerName: demo.name, phone: demo.phone, orderNumber: "ASL-ORD-021058", item: "R3 Denim - Dark Blue · 32", work: ["Hem jeans or trousers"], notes: "Stacked hem, 2cm break over sneakers.", fee: 0, storeId: "LOC-1001", staffId: "s3", tailor: "In-house · Ikoyi", createdAt: days(-3), readyBy: days(1), status: "with-tailor" },
    { id: "al2", number: "ALT-2042", customerId: o[0].id, customerName: o[0].name, phone: o[0].phone, orderNumber: "ASL-ORD-021061", item: "Relaxed Fit Cargo Pants · L", work: ["Taper legs", "Hem jeans or trousers"], notes: "Taper from the knee. Keep the cuff.", fee: 0, storeId: "LOC-1001", staffId: "s2", tailor: "Bayo Tailoring, Yaba", createdAt: days(-5), readyBy: days(0), status: "ready" },
    { id: "al3", number: "ALT-2043", customerName: o[3].name, customerId: o[3].id, phone: o[3].phone, item: "Customer's own: agbada", work: ["Take in waist"], notes: "Take in 2cm. Bought elsewhere.", fee: 12000, storeId: "LOC-1001", staffId: "s3", tailor: "In-house · Ikoyi", createdAt: days(-1), readyBy: days(3), status: "received" },
    { id: "al4", number: "ALT-2039", customerName: o[4].name, customerId: o[4].id, phone: o[4].phone, orderNumber: "ASL-ORD-021032", item: "Fleece Shorts - Grey · M", work: ["Hem jeans or trousers"], notes: "", fee: 8000, storeId: "LOC-1002", staffId: "s4", tailor: "In-house · Ikoyi", createdAt: days(-9), readyBy: days(-5), status: "collected", collectedAt: days(-4) },
  ];
  // Supplier names from the admin's Suppliers page (suppliers-store.ts) are for concierge sourcing; these are stock deliveries.
  const deliveries: Delivery[] = [
    { id: "dl1", number: "PO-3107", supplier: "Nike Africa (distributor)", storeId: "LOC-1001", expectedAt: days(0), status: "expected", lines: [{ variantId: v("f1", 2), qty: 2, received: 0 }, { variantId: v("f1", 3), qty: 2, received: 0 }, { variantId: v("c2", 1), qty: 3, received: 0 }, { variantId: v("a2"), qty: 4, received: 0 }] },
    { id: "dl2", number: "PO-3110", supplier: "Represent Clo. (wholesale)", storeId: "LOC-1001", expectedAt: days(2), status: "expected", lines: [{ variantId: v("c6", 2), qty: 2, received: 0 }, { variantId: v("tr1", 1), qty: 6, received: 0 }] },
    { id: "dl3", number: "PO-3098", supplier: "Lagos Flagship DC", storeId: "LOC-1001", expectedAt: days(-6), status: "received", receivedAt: days(-6), receivedBy: "s2", lines: [{ variantId: v("fr3"), qty: 2, received: 2 }, { variantId: v("a9"), qty: 3, received: 3 }] },
  ];
  const step = (status: Transfer["status"], ago: number, by: string) => ({ status, at: days(-ago), by });
  const transfers: Transfer[] = [
    { id: "tr1", number: "TR-511", at: days(-0.2), fromStoreId: "LOC-1002", toStoreId: "LOC-1001", variantId: v("f8", 3), qty: 1, status: "requested", requestedBy: "s3", reason: `Customer waiting: ${demo.name}`, steps: [step("requested", 0.2, "s3")] },
    { id: "tr2", number: "TR-509", at: days(-1), fromStoreId: "lag", toStoreId: "LOC-1001", variantId: v("fr1"), qty: 2, status: "in-transit", requestedBy: "s2", reason: "Low stock", steps: [step("requested", 1, "s2"), step("approved", 0.9, "s1"), step("in-transit", 0.6, "s1")] },
    { id: "tr3", number: "TR-510", at: days(-0.8), fromStoreId: "LOC-1001", toStoreId: "LOC-1003", variantId: v("f2", 2), qty: 1, status: "approved", requestedBy: "s5", reason: "Customer order", steps: [step("requested", 0.8, "s5"), step("approved", 0.5, "s1")] },
    { id: "tr4", number: "TR-505", at: days(-4), fromStoreId: "LOC-1003", toStoreId: "LOC-1002", variantId: v("c9", 1), qty: 2, status: "received", requestedBy: "s4", steps: [step("requested", 4, "s4"), step("approved", 3.9, "s1"), step("in-transit", 3.5, "s5"), step("received", 2, "s4")] },
  ];
  const counts: StockCount[] = [
    { id: "sc1", number: "SC-88", storeId: "LOC-1001", at: days(-7), staffId: "s3", approvedBy: "s2", scope: "Fragrances", lines: [{ variantId: v("fr3"), expected: 4, counted: 4 }, { variantId: v("fr8"), expected: 3, counted: 2 }, { variantId: v("fr9"), expected: 5, counted: 5 }] },
  ];
  const audit: AuditEvent[] = [
    { id: "a1", at: days(-0.05), storeId: "LOC-1001", registerId: "r1", staffId: "s3", approvedBy: "s2", action: "discount", text: "20% off whole sale (Loyal customer), over Halima's 10% limit", amount: 42000, ref: "ASL-ORD-021088" },
    { id: "a2", at: days(-0.1), storeId: "LOC-1001", registerId: "r1", staffId: "s3", action: "drawer", text: "Drawer opened with no sale (change for a customer)" },
    { id: "a3", at: days(-0.3), storeId: "LOC-1002", registerId: "r3", staffId: "s4", approvedBy: "s5", action: "price", text: "Price of R3 Denim - Light Blue set at ₦150,000 (price on request)", amount: 150000, ref: "ASL-ORD-021084" },
    { id: "a4", at: days(-0.6), storeId: "LOC-1001", registerId: "r1", staffId: "s2", action: "cash", text: "Paid out ₦20,000 (Bank deposit)", amount: 20000 },
    { id: "a5", at: days(-1.1), storeId: "LOC-1001", registerId: "r1", staffId: "s3", approvedBy: "s1", action: "refund", text: "Refund of ₦285,000 over the ₦250,000 approval limit", amount: 285000, ref: "RT-1071" },
    { id: "a6", at: days(-1.4), storeId: "LOC-1003", registerId: "r4", staffId: "s5", action: "void", text: "Cleared a sale with 3 items (₦412,000)", amount: 412000 },
    { id: "a7", at: days(-2), storeId: "LOC-1002", registerId: "r3", staffId: "s4", approvedBy: "s5", action: "stock", text: "F9-42 −1 (Damaged)", ref: "F9-42" },
    { id: "a8", at: days(-2.2), storeId: "LOC-1001", registerId: "r2", staffId: "s3", action: "drawer", text: "Drawer opened with no sale (counting float)" },
    { id: "a9", at: days(-3), storeId: "LOC-1001", registerId: "r1", staffId: "s2", action: "giftcard", text: "Sold gift card GC-4821-7730 for ₦100,000", amount: 100000, ref: "GC-4821-7730" },
    { id: "a10", at: days(-7), storeId: "LOC-1001", staffId: "s3", approvedBy: "s2", action: "count", text: "Stock count SC-88 (Fragrances): 1 missing, ₦385,000 at retail", amount: 385000, ref: "SC-88" },
  ];
  void cid;
  return { alterations, deliveries, transfers, counts, audit };
}

/** Same order numbers as the website (orders-store.ts makeId): ASL-ORD- and six digits. */
let orderSeq = 21000;
export const orderNo = (n: number) => `ASL-ORD-${String(n).padStart(6, "0")}`;
export const nextNumber = () => orderNo(++orderSeq);

/** Two weeks of trading across stores and online, so lists and dashboards have something real to show. */
export function buildHistory(products: Product[]): { orders: Order[]; sessions: Session[]; seq: number } {
  const orders: Order[] = [];
  const nowMs = Date.now();
  let k = 0;
  for (let day = 13; day >= 0; day--) {
    const perDay = 6 + Math.floor(rand(day + 50) * 6);
    for (let j = 0; j < perDay; j++) {
      k += 1;
      const at = new Date(nowMs - day * 86400e3);
      at.setHours(10 + Math.floor(rand(k) * 10), Math.floor(rand(k + 1) * 60), 0, 0);
      if (at.getTime() > nowMs) continue;
      const r = rand(k + 2);
      const channel = r < 0.55 ? "pos" : r < 0.82 ? "web" : "app";
      const storeId = channel === "pos" ? (["LOC-1001", "LOC-1001", "LOC-1002", "LOC-1003"] as const)[Math.floor(rand(k + 3) * 4)] : undefined;
      const lines: OrderLine[] = [];
      const count = 1 + Math.floor(rand(k + 4) * 2.4);
      for (let l = 0; l < count; l++) {
        const p = products[Math.floor(rand(k * 3 + l) * products.length)];
        const v = p.variants[Math.floor(rand(k * 5 + l) * p.variants.length)];
        if (lines.some((x) => x.variantId === v.id)) continue;
        const seller = storeId === "LOC-1001" ? (rand(k + l + 20) < 0.55 ? "s3" : "s2") : storeId === "LOC-1002" ? (rand(k + l + 20) < 0.6 ? "s4" : "s5") : storeId === "LOC-1003" ? "s5" : undefined;
        lines.push({ productId: p.id, variantId: v.id, name: p.name, brand: p.brand, image: p.image, variantLabel: label(v), sku: v.sku, qty: 1, unitPrice: p.price, lineDiscount: 0, net: p.price, returnedQty: 0, soldBy: seller });
      }
      const total = lines.reduce((a, l) => a + l.net, 0);
      const cust = rand(k + 6) < 0.65 ? CUSTOMERS[Math.floor(rand(k + 7) * CUSTOMERS.length)] : undefined;
      const method = channel === "pos" ? (["card", "card", "transfer", "cash"] as const)[Math.floor(rand(k + 8) * 4)] : "card";
      const pickup = channel !== "pos" && rand(k + 9) < 0.4;
      const fresh = day === 0 || (day === 1 && rand(k) < 0.5);
      orders.push({
        id: `o${k}`,
        number: nextNumber(),
        channel,
        storeId,
        registerId: storeId === "LOC-1001" ? "r1" : storeId === "LOC-1002" ? "r3" : storeId === "LOC-1003" ? "r4" : undefined,
        staffId: storeId ? (storeId === "LOC-1001" ? (rand(k) < 0.5 ? "s3" : "s2") : storeId === "LOC-1002" ? "s4" : "s5") : undefined,
        customerId: cust?.id ?? (channel !== "pos" ? CUSTOMERS[k % CUSTOMERS.length].id : undefined),
        customerName: cust?.name ?? (channel !== "pos" ? CUSTOMERS[k % CUSTOMERS.length].name : undefined),
        lines,
        subtotal: total,
        discountTotal: 0,
        pointsRedeemed: 0,
        total,
        vat: Math.round((total * 7.5) / 107.5),
        payments: [{ method: channel === "pos" ? method : "card", amount: total, reference: channel === "pos" ? undefined : `PSK-${100000 + k}` }],
        change: 0,
        status: channel === "pos" ? "completed" : pickup ? (fresh ? (rand(k + 10) < 0.5 ? "ready" : "processing") : "collected") : fresh ? "processing" : "delivered",
        fulfilment: channel === "pos" ? "instore" : pickup ? "pickup" : "delivery",
        pickupStoreId: pickup ? (rand(k + 11) < 0.7 ? "LOC-1001" : "LOC-1002") : undefined,
        pickupCode: pickup ? String(100000 + Math.floor(rand(k + 12) * 899999)) : undefined,
        createdAt: at.toISOString(),
        returns: [],
        pointsEarned: Math.floor(total / 1000),
        synced: true,
      });
    }
  }
  // Make sure the demo always has pickups waiting at the flagship.
  const pickups = orders.filter((o) => o.fulfilment === "pickup" && o.pickupStoreId === "LOC-1001" && (o.status === "ready" || o.status === "processing"));
  if (pickups.length < 3) {
    for (const o of orders.filter((o) => o.channel !== "pos").slice(-6, -6 + 3 - pickups.length || undefined)) {
      Object.assign(o, { fulfilment: "pickup", pickupStoreId: "LOC-1001", pickupCode: String(400000 + Number(o.id.slice(1))), status: "ready" });
    }
  }
  const sessions: Session[] = [];
  for (let day = 6; day >= 1; day--) {
    for (const reg of ["r1", "r3", "r4"]) {
      const open = new Date(nowMs - day * 86400e3);
      open.setHours(9, 45, 0, 0);
      const close = new Date(open);
      close.setHours(20, 10, 0, 0);
      const storeId = REGISTERS.find((r) => r.id === reg)!.storeId;
      const cashSales = orders.filter((o) => o.registerId === reg && sameDay(o.createdAt, open)).flatMap((o) => o.payments).filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
      const expected = 50000 + cashSales - (day % 3 === 0 ? 20000 : 0);
      const variance = day === 2 && reg === "r3" ? -1500 : day === 4 && reg === "r1" ? 500 : 0;
      sessions.push({
        id: `ss-${reg}-${day}`,
        registerId: reg,
        storeId,
        openedBy: storeId === "LOC-1001" ? "s3" : storeId === "LOC-1002" ? "s4" : "s5",
        openedAt: open.toISOString(),
        float: 50000,
        moves: day % 3 === 0 ? [{ id: `m${day}${reg}`, at: open.toISOString(), type: "out", amount: 20000, reason: "Bank deposit", staffId: "s2" }] : [],
        closedAt: close.toISOString(),
        closedBy: storeId === "LOC-1001" ? "s2" : "s5",
        counted: expected + variance,
        expected,
      });
    }
  }
  return { orders: orders.reverse(), sessions: sessions.reverse(), seq: orderSeq };
}

export function label(v: Variant) {
  return v.size === "One Size" ? v.colour : `${v.colour} · ${v.size}`;
}

export function sameDay(a: string | Date, b: string | Date) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export const CATEGORIES: Category[] = ["Clothing", "Footwear", "Accessories", "Fragrances"];
