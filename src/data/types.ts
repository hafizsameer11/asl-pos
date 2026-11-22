/** Prototype data model. Money is whole naira. In the real build this all lives in the store's backend. */

/** The website and app categories (shop-data.ts). */
export type Category = "Clothing" | "Footwear" | "Accessories" | "Fragrances";
export type Role = "Cashier" | "Supervisor" | "Manager";
export type Channel = "pos" | "web" | "app";
/** "wallet" is the ASL Wallet the customer also tops up and spends in the app. */
export type PayMethod = "cash" | "card" | "transfer" | "wallet" | "points" | "giftcard";
/** ASL Club tiers (club-store.ts / customers-store.ts CustomerTier). */
export type Tier = "Standard" | "Silver" | "Gold" | "Signature";
export type Availability = "In Stock" | "Pre Order" | "Limited Pieces" | "Restocked";

export interface Colour {
  name: string;
  hex: string;
}

export interface Variant {
  id: string;
  sku: string;
  barcode: string;
  colour: string;
  size: string;
}

/** A product as the website and app hold it, before the till adds variants and barcodes. */
export interface CatalogItem {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory?: string;
  image: string;
  price: number;
  compareAt?: number;
  description: string;
  colour: Colour;
  sizes: string[];
  availability: Availability;
  /** Shown as "On Request" on the website: the price is confirmed by staff. */
  priceOnRequest?: boolean;
  /** Flagged out of stock on the website. */
  soldOut?: boolean;
  sizeLabels?: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory?: string;
  image: string;
  price: number;
  compareAt?: number;
  description: string;
  availability: Availability;
  priceOnRequest?: boolean;
  sizeLabels?: Record<string, string>;
  colours: Colour[];
  sizes: string[];
  variants: Variant[];
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  kind: "store" | "warehouse";
  sellsInPerson: boolean;
  /** Boutique stock warehouse (POS live). Same as `id` for warehouse-kind rows. */
  warehouseId?: string;
}

export interface Register {
  id: string;
  name: string;
  storeId: string;
  /** Stock warehouse for this till (POS live). */
  warehouseId?: string;
  device: string;
  printer: string;
  terminalId: string;
  drawer: boolean;
  scanner: string;
  online: boolean;
  lastSeen: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  pin: string;
  storeIds: string[];
  active: boolean;
  /** Live mode: Nest `pos.*` permissions from JWT / staff list. */
  permissions?: string[];
  discountLimitPct?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: Tier;
  /** Same fields as the admin Customer (customers-store.ts). */
  loyaltyPoints: number;
  walletBalance: number;
  /** Lifetime spend, which sets the ASL Club tier. */
  spend: number;
  orders: number;
  joined: string;
  city?: string;
  tags?: string[];
  birthday?: string;
  note?: string;
  /** Saved sizes, used to pre-select sizes at the till. */
  sizes?: Partial<Record<SizeKind, string>>;
  /** Product ids saved to the wishlist on the website or app. */
  wishlist?: string[];
}

export type SizeKind = "top" | "bottom" | "shoe";

/** Same codes and rules as the admin Coupons page (coupons-store.ts). "store" is the channel the POS adds. */
export type CouponChannel = "web" | "mobile" | "concierge" | "store";
export interface Coupon {
  code: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
  minSpend: number;
  maxDiscount?: number;
  active: boolean;
  channels: CouponChannel[];
  expires: string;
}

export interface OrderLine {
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  image: string;
  variantLabel: string;
  sku: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  net: number;
  returnedQty: number;
  /** Automatic promotion taken off this line (included in lineDiscount). */
  promo?: number;
  /** Sales associate credited with this line. */
  soldBy?: string;
  /** Set when the item ships to the customer from another location. */
  shipFrom?: string;
}

/** Charges on a sale that aren't catalogue items: gift cards sold, alterations, delivery. Not discountable. */
export interface Extra {
  kind: "giftcard" | "alteration" | "delivery";
  label: string;
  amount: number;
  ref?: string;
}

export interface Payment {
  method: PayMethod;
  amount: number;
  reference?: string;
}

export interface ReturnRec {
  id: string;
  number: string;
  createdAt: string;
  staffId: string;
  storeId: string;
  registerId?: string;
  reason: string;
  lines: { lineIndex: number; qty: number; amount: number; restock: boolean }[];
  amount: number;
  refunds: Payment[];
  kind: "refund" | "exchange";
  exchangeOrder?: string;
  approvedBy?: string;
}

export type OrderStatus = "reserved" | "completed" | "processing" | "ready" | "collected" | "delivered" | "refunded" | "part-refunded" | "cancelled";

export interface Order {
  id: string;
  number: string;
  channel: Channel;
  storeId?: string;
  registerId?: string;
  sessionId?: string;
  staffId?: string;
  customerId?: string;
  customerName?: string;
  lines: OrderLine[];
  subtotal: number;
  discountTotal: number;
  couponCode?: string;
  couponAmount?: number;
  manualDiscount?: { amount: number; reason: string };
  pointsRedeemed: number;
  total: number;
  vat: number;
  payments: Payment[];
  change: number;
  status: OrderStatus;
  fulfilment: "instore" | "pickup" | "delivery";
  pickupCode?: string;
  pickupStoreId?: string;
  createdAt: string;
  collectedAt?: string;
  returns: ReturnRec[];
  pointsEarned: number;
  synced: boolean;
  note?: string;
  creditApplied?: number;
  exchangeFrom?: string;
  promos?: { id: string; label: string; amount: number }[];
  extras?: Extra[];
  /** Reservation: part paid now, the rest on collection. */
  reservation?: { deposit: number; balance: number; until: string; status: "open" | "paid" | "cancelled"; paidAt?: string };
  delivery?: { name: string; phone: string; address: string; city: string; zone: string; fee: number; fromStoreId: string; status: "processing" | "dispatched" | "delivered"; eta: string };
}

export interface CashMove {
  id: string;
  at: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  staffId: string;
}

export interface Session {
  id: string;
  registerId: string;
  storeId: string;
  openedBy: string;
  openedAt: string;
  float: number;
  moves: CashMove[];
  closedAt?: string;
  closedBy?: string;
  counted?: number;
  expected?: number;
  note?: string;
}

export type Permission =
  | "discount"
  | "priceOverride"
  | "refund"
  | "refundNoReceipt"
  | "voidSale"
  | "cashMoves"
  | "openClose"
  | "stockAdjust"
  | "viewReports";

export interface Settings {
  general: { posEnabled: boolean; vatRate: number; pricesIncludeVat: boolean; cashRounding: number; requireCustomerOver: number };
  payments: {
    cash: boolean;
    card: boolean;
    transfer: boolean;
    wallet: boolean;
    points: boolean;
    split: boolean;
    quickTender: number[];
    cardProvider: string;
    transferAccounts: { bank: string; name: string; number: string }[];
    transferNeedsRef: boolean;
  };
  discounts: { limits: Record<Role, number>; requireReason: boolean; reasons: string[]; couponsAtPos: boolean; stackCoupons: boolean };
  receipts: {
    header: string;
    footer: string;
    showVat: boolean;
    showLoyalty: boolean;
    showPolicy: boolean;
    showQr: boolean;
    showStaff: boolean;
    giftReceipts: boolean;
    channels: { print: boolean; email: boolean; sms: boolean; whatsapp: boolean };
    paper: "80mm" | "58mm" | "A4";
  };
  returns: {
    windowDays: number;
    requireReceipt: boolean;
    approvalOver: number;
    toOriginal: boolean;
    toCredit: boolean;
    toCash: boolean;
    restockDefault: boolean;
    exchanges: boolean;
    onlineOrdersInStore: boolean;
    reasons: string[];
    /** Categories or subcategories that cannot be returned. */
    finalSale: string[];
  };
  cash: { defaultFloat: number; blindClose: boolean; tolerance: number; denominations: number[]; inReasons: string[]; outReasons: string[] };
  /** ASL Club rules, read from the admin ASL Club page (club-store.ts). The till only adds earnAtPos, redeemAtPos and minRedeem. */
  loyalty: {
    earnAtPos: boolean;
    redeemAtPos: boolean;
    /** ₦ value of one point (ClubRule.pointValueNaira). */
    pointValue: number;
    /** Spend that earns one base point (ClubRule: 1 point per ₦1,000). */
    earnPer: number;
    minRedeem: number;
    multipliers: Record<Tier, number>;
    /** Lifetime spend that qualifies for each tier (ClubTier.minSpend). */
    minSpend: Record<Tier, number>;
    birthdayBonus: number;
  };
  offline: { allowed: boolean; maxSale: number; syncSeconds: number; oversell: "allow" | "warn" | "block"; pickupsOffline: boolean };
  roles: Record<Role, Record<Permission, boolean>>;
  services: {
    layaway: boolean;
    minDepositPct: number;
    holdDays: number;
    cancelRefund: "wallet" | "original" | "keep";
    alterations: boolean;
    alterationMenu: { name: string; price: number }[];
    freeAlterationsOver: number;
    tailors: string[];
    turnaroundDays: number;
    delivery: boolean;
    zones: { name: string; fee: number; days: number }[];
    freeDeliveryOver: number;
    giftCards: boolean;
    giftCardPresets: number[];
    giftCardExpiryMonths: number;
  };
  commission: { enabled: boolean; rates: Record<Role, number>; targets: Record<string, number>; attributeBy: "associate" | "cashier" };
}

export interface Promotion {
  id: string;
  name: string;
  /** Short text printed on the receipt and shown in the cart. */
  label: string;
  /** bxgy: buy `buy`, get `get` free (cheapest). percent: value% off. spend: ₦value off when the scope adds up to minSpend. birthday: value% off in the customer's birthday month. */
  kind: "bxgy" | "percent" | "spend" | "birthday";
  buy?: number;
  get?: number;
  value: number;
  minSpend?: number;
  scope: { type: "all" | "category" | "brand"; value?: string };
  channels: Channel[];
  /** Empty means every store. */
  stores: string[];
  starts: string;
  ends: string;
  active: boolean;
}

export interface GiftCard {
  code: string;
  initial: number;
  balance: number;
  issuedAt: string;
  storeId?: string;
  customerId?: string;
  expires: string;
  status: "active" | "used" | "cancelled";
  history: { at: string; amount: number; kind: "issued" | "redeemed" | "refunded" | "adjusted"; ref: string }[];
}

export interface Alteration {
  id: string;
  number: string;
  customerId?: string;
  customerName: string;
  phone: string;
  orderNumber?: string;
  item: string;
  work: string[];
  notes: string;
  fee: number;
  storeId: string;
  staffId: string;
  tailor: string;
  createdAt: string;
  readyBy: string;
  status: "received" | "with-tailor" | "ready" | "collected";
  collectedAt?: string;
}

/** A supplier delivery the store expects and checks in by scanning. */
export interface Delivery {
  id: string;
  number: string;
  supplier: string;
  storeId: string;
  expectedAt: string;
  lines: { variantId: string; qty: number; received: number }[];
  status: "expected" | "partial" | "received";
  receivedAt?: string;
  receivedBy?: string;
}

export interface StockCount {
  id: string;
  number: string;
  storeId: string;
  at: string;
  staffId: string;
  approvedBy?: string;
  scope: string;
  lines: { variantId: string; expected: number; counted: number }[];
}

/**
 * A concierge request started at the till. Same shape and statuses as the admin's Requests Inbox
 * (concierge-requests-store.ts: ASL-REQ- ids, New → Sourcing → Quoted → …, Standard / Priority / VIP).
 */
export interface ConciergeRequest {
  id: string;
  customerId?: string;
  customerName: string;
  phone: string;
  item: string;
  category: string;
  size?: string;
  budget?: number;
  notes: string;
  priority: "Standard" | "Priority" | "VIP";
  productId?: string;
  storeId: string;
  staffId: string;
  createdAt: string;
  status: "New" | "Sourcing" | "Quoted" | "Approved" | "Ordered" | "In Transit" | "Delivered" | "Cancelled";
}

export interface AuditEvent {
  id: string;
  at: string;
  storeId?: string;
  registerId?: string;
  staffId: string;
  approvedBy?: string;
  action: "discount" | "price" | "refund" | "void" | "cash" | "drawer" | "stock" | "count" | "transfer" | "giftcard" | "reservation" | "concierge";
  text: string;
  amount?: number;
  ref?: string;
}

export interface Activity {
  id: string;
  at: string;
  text: string;
  kind: "sale" | "refund" | "pickup" | "register" | "settings" | "stock" | "sync" | "online";
}

export interface Transfer {
  id: string;
  number: string;
  at: string;
  fromStoreId: string;
  toStoreId: string;
  variantId: string;
  qty: number;
  status: "requested" | "approved" | "in-transit" | "received" | "rejected";
  requestedBy: string;
  reason?: string;
  /** Who did each step, and when. */
  steps: { status: Transfer["status"]; at: string; by: string }[];
}
