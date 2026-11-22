import { liveMode } from "./client";
import { fromKobo } from "./money";
import { applyPosSettingsToLocal } from "./posSettingsMap";
import { mapPromo, type ApiPromo } from "./promoMap";
import { posApi, toStaff, type ApiRegister, type CatalogProduct } from "./pos";
import { useDb } from "../data/store";
import type { Category, Product, Register, Store } from "../data/types";

function mapCategory(name: string): Category {
  const n = name.toLowerCase();
  if (n.includes("foot") || n.includes("shoe")) return "Footwear";
  if (n.includes("access")) return "Accessories";
  if (n.includes("frag")) return "Fragrances";
  return "Clothing";
}

function mapAvailability(a: string): Product["availability"] {
  if (a === "pre_order") return "Pre Order";
  if (a === "limited") return "Limited Pieces";
  if (a === "restocked") return "Restocked";
  return "In Stock";
}

export function catalogToProducts(rows: CatalogProduct[], stockKey: string): { products: Product[]; inventory: Record<string, Record<string, number>> } {
  const inventory: Record<string, Record<string, number>> = {};
  const products: Product[] = rows.map((p) => {
    const colours = [...new Set(p.variants.map((v) => v.color).filter(Boolean) as string[])].map((name) => ({ name, hex: "#888" }));
    const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean) as string[])];
    for (const v of p.variants) {
      inventory[v.id] = { [stockKey]: v.stock.here ?? 0 };
    }
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: mapCategory(p.category),
      image: p.image ?? "",
      price: fromKobo(p.price),
      compareAt: p.compareAt != null ? fromKobo(p.compareAt) : undefined,
      description: "",
      availability: mapAvailability("in_stock"),
      colours: colours.length ? colours : [{ name: "Default", hex: "#888" }],
      sizes: sizes.length ? sizes : ["One size"],
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode || v.sku,
        colour: v.color || "Default",
        size: v.size || "One size",
      })),
    };
  });
  return { products, inventory };
}

export function registersToLocal(rows: ApiRegister[]): { stores: Store[]; registers: Register[] } {
  const byLoc = new Map<string, { loc: ApiRegister["location"]; warehouseId: string }>();
  for (const r of rows) {
    if (!r.location) continue;
    const prev = byLoc.get(r.locationId);
    if (!prev) byLoc.set(r.locationId, { loc: r.location, warehouseId: r.warehouse.id });
  }
  const stores: Store[] = [...byLoc.entries()].map(([id, { loc, warehouseId }]) => ({
    id,
    name: loc?.name ?? id,
    address: loc?.city ?? "",
    phone: "",
    hours: "",
    kind: "store",
    sellsInPerson: true,
    warehouseId,
  }));
  for (const r of rows) {
    if (!stores.some((s) => s.id === r.warehouse.id)) {
      stores.push({
        id: r.warehouse.id,
        name: r.warehouse.name,
        address: "",
        phone: "",
        hours: "",
        kind: "warehouse",
        sellsInPerson: false,
        warehouseId: r.warehouse.id,
      });
    }
  }
  const registers: Register[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    storeId: r.locationId,
    warehouseId: r.warehouse.id,
    device: r.device ?? "",
    printer: "",
    terminalId: r.terminalId ?? "",
    drawer: true,
    scanner: "",
    online: r.online,
    lastSeen: r.lastSeenAt ?? new Date().toISOString(),
  }));
  return { stores, registers };
}

/** Pull registers + catalog (+ me as staff) into the local Zustand cache. */
export async function hydrateFromApi(registerId?: string) {
  if (!liveMode()) return;
  const regs = await posApi.listRegisters();
  const { stores, registers } = registersToLocal(regs);
  const me = await posApi.me();
  const staff = toStaff(me);
  let team = [staff];
  try {
    const rows = (await (await import("./pos")).adminPosApi.staff()) as {
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      locationIds: string[];
      hasPin: boolean;
      permissions?: string[];
      discountLimitPct?: number;
    }[];
    if (Array.isArray(rows) && rows.length) {
      const { mapStoreRole } = await import("./permissions");
      team = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: mapStoreRole(r.role),
        pin: r.hasPin ? "****" : "",
        storeIds: r.locationIds ?? [],
        active: r.status === "active",
        permissions: r.permissions,
        discountLimitPct: r.discountLimitPct,
      }));
      if (!team.some((t) => t.id === staff.id)) team = [staff, ...team];
    }
  } catch {
    /* cashiers without pos.manage keep self only */
  }
  const pick = registerId && registers.some((r) => r.id === registerId) ? registerId : registers[0]?.id;
  if (pick) localStorage.setItem("asl-pos-register", pick);
  const cat = await posApi.catalog({ pageSize: 200 });
  const activeReg = registers.find((r) => r.id === pick);
  const stockKey = activeReg?.warehouseId ?? activeReg?.storeId ?? stores[0]?.warehouseId ?? stores[0]?.id ?? "";
  const { products, inventory } = catalogToProducts(cat, stockKey);

  const openSessions = regs
    .filter((r) => r.openSession)
    .map((r) => ({
      id: r.openSession!.id,
      registerId: r.id,
      storeId: r.locationId,
      openedBy: r.openSession!.openedById,
      openedAt: typeof r.openSession!.openedAt === "string" ? r.openSession!.openedAt : new Date(r.openSession!.openedAt).toISOString(),
      float: fromKobo(r.openSession!.float),
      moves: [],
    }));

  let settingsPatch = {};
  try {
    const raw = await posApi.settings();
    const pos = (raw as { pos?: Record<string, unknown> })?.pos ?? (raw as Record<string, unknown>);
    settingsPatch = applyPosSettingsToLocal(pos);
  } catch {
    /* keep demo defaults if settings unavailable */
  }

  let promotions = useDb.getState().promotions;
  try {
    const promoRows = await posApi.promotions();
    if (Array.isArray(promoRows)) promotions = (promoRows as ApiPromo[]).map(mapPromo);
  } catch {
    /* keep seeded promos */
  }

  const prev = useDb.getState().settings;
  const discPatch = (settingsPatch as { discounts?: typeof prev.discounts }).discounts;
  const limits = { ...prev.discounts.limits, ...(discPatch?.limits ?? {}) };
  for (const t of team) {
    if (t.discountLimitPct != null) limits[t.role] = t.discountLimitPct;
  }
  useDb.setState({
    stores,
    registers,
    staff: team,
    products,
    inventory,
    sessions: openSessions,
    customers: [],
    orders: [],
    giftCards: [],
    coupons: [],
    alterations: [],
    transfers: [],
    deliveries: [],
    counts: [],
    auditLog: [],
    promotions,
    settings: {
      ...prev,
      ...settingsPatch,
      general: { ...prev.general, ...(settingsPatch as { general?: typeof prev.general }).general },
      discounts: { ...prev.discounts, ...discPatch, limits },
      receipts: { ...prev.receipts, ...(settingsPatch as { receipts?: typeof prev.receipts }).receipts },
      returns: { ...prev.returns, ...(settingsPatch as { returns?: typeof prev.returns }).returns },
      cash: { ...prev.cash, ...(settingsPatch as { cash?: typeof prev.cash }).cash },
      loyalty: { ...prev.loyalty, ...(settingsPatch as { loyalty?: typeof prev.loyalty }).loyalty },
      offline: { ...prev.offline, ...(settingsPatch as { offline?: typeof prev.offline }).offline },
      services: { ...prev.services, ...(settingsPatch as { services?: typeof prev.services }).services },
      payments: { ...prev.payments, ...(settingsPatch as { payments?: typeof prev.payments }).payments },
    },
  });

  return { registerId: pick, staff, openSessionId: openSessions.find((s) => s.registerId === pick)?.id ?? null };
}
