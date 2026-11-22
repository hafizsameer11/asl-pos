import type { Settings } from "../data/types";
import { fromKobo, toKobo } from "./money";

export type ApiPosSettings = Record<string, unknown>;

/** Merge Nest `pos` settings group into local demo settings shape (naira in UI). */
export function applyPosSettingsToLocal(pos: ApiPosSettings): Partial<Settings> {
  const p = pos as {
    requireCustomerOver?: number;
    couponsAtPos?: boolean;
    receiptFooter?: string;
    returnWindowDays?: number;
    refundApprovalOver?: number;
    defaultFloat?: number;
    blindClose?: boolean;
    cashTolerance?: number;
    earnLoyaltyAtPos?: boolean;
    redeemLoyaltyAtPos?: boolean;
    minRedeemPoints?: number;
    offlineAllowed?: boolean;
    offlineMaxSale?: number;
    oversell?: Settings["offline"]["oversell"];
    pickupsOffline?: boolean;
    giftCardsEnabled?: boolean;
    layawayEnabled?: boolean;
    layawayMinDepositPct?: number;
    layawayHoldDays?: number;
    layawayCancelRefund?: Settings["services"]["cancelRefund"];
    alterationsEnabled?: boolean;
    freeAlterationsOver?: number;
    finalSaleCategories?: string[];
  };
  const out: Partial<Settings> = {};
  if (p.requireCustomerOver != null) out.general = { ...(out.general ?? {}), requireCustomerOver: fromKobo(p.requireCustomerOver) } as Settings["general"];
  if (p.couponsAtPos != null) out.discounts = { ...(out.discounts ?? {}), couponsAtPos: p.couponsAtPos } as Settings["discounts"];
  if (p.receiptFooter != null) out.receipts = { ...(out.receipts ?? {}), footer: p.receiptFooter } as Settings["receipts"];
  if (p.returnWindowDays != null || p.refundApprovalOver != null || p.finalSaleCategories != null) {
    out.returns = {
      ...(out.returns ?? {}),
      ...(p.returnWindowDays != null ? { windowDays: p.returnWindowDays } : {}),
      ...(p.refundApprovalOver != null ? { approvalOver: fromKobo(p.refundApprovalOver) } : {}),
      ...(p.finalSaleCategories != null ? { finalSale: p.finalSaleCategories } : {}),
    } as Settings["returns"];
  }
  if (p.defaultFloat != null || p.blindClose != null || p.cashTolerance != null) {
    out.cash = {
      ...(out.cash ?? {}),
      ...(p.defaultFloat != null ? { defaultFloat: fromKobo(p.defaultFloat) } : {}),
      ...(p.blindClose != null ? { blindClose: p.blindClose } : {}),
      ...(p.cashTolerance != null ? { tolerance: fromKobo(p.cashTolerance) } : {}),
    } as Settings["cash"];
  }
  if (p.earnLoyaltyAtPos != null || p.redeemLoyaltyAtPos != null || p.minRedeemPoints != null) {
    out.loyalty = {
      ...(out.loyalty ?? {}),
      ...(p.earnLoyaltyAtPos != null ? { earnAtPos: p.earnLoyaltyAtPos } : {}),
      ...(p.redeemLoyaltyAtPos != null ? { redeemAtPos: p.redeemLoyaltyAtPos } : {}),
      ...(p.minRedeemPoints != null ? { minRedeem: p.minRedeemPoints } : {}),
    } as Settings["loyalty"];
  }
  if (p.offlineAllowed != null || p.offlineMaxSale != null || p.oversell != null || p.pickupsOffline != null) {
    out.offline = {
      ...(out.offline ?? {}),
      ...(p.offlineAllowed != null ? { allowed: p.offlineAllowed } : {}),
      ...(p.offlineMaxSale != null ? { maxSale: fromKobo(p.offlineMaxSale) } : {}),
      ...(p.oversell != null ? { oversell: p.oversell } : {}),
      ...(p.pickupsOffline != null ? { pickupsOffline: p.pickupsOffline } : {}),
    } as Settings["offline"];
  }
  if (
    p.layawayEnabled != null ||
    p.layawayMinDepositPct != null ||
    p.layawayHoldDays != null ||
    p.layawayCancelRefund != null ||
    p.alterationsEnabled != null ||
    p.giftCardsEnabled != null ||
    p.freeAlterationsOver != null
  ) {
    out.services = {
      ...(out.services ?? {}),
      ...(p.layawayEnabled != null ? { layaway: p.layawayEnabled } : {}),
      ...(p.layawayMinDepositPct != null ? { minDepositPct: p.layawayMinDepositPct } : {}),
      ...(p.layawayHoldDays != null ? { holdDays: p.layawayHoldDays } : {}),
      ...(p.layawayCancelRefund != null ? { cancelRefund: p.layawayCancelRefund } : {}),
      ...(p.alterationsEnabled != null ? { alterations: p.alterationsEnabled } : {}),
      ...(p.giftCardsEnabled != null ? { giftCards: p.giftCardsEnabled } : {}),
      ...(p.freeAlterationsOver != null ? { freeAlterationsOver: fromKobo(p.freeAlterationsOver) } : {}),
    } as Settings["services"];
  }
  if (p.redeemLoyaltyAtPos != null) out.payments = { ...(out.payments ?? {}), points: p.redeemLoyaltyAtPos } as Settings["payments"];
  return out;
}

/** Map a patch from one UI settings group to Nest `pos` patch keys (kobo where needed). */
export function localPatchToPosApi<K extends keyof Settings>(key: K, patch: Partial<Settings[K]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const p = patch as Record<string, unknown>;
  if (key === "general" && p.requireCustomerOver != null) out.requireCustomerOver = toKobo(p.requireCustomerOver as number);
  if (key === "discounts" && p.couponsAtPos != null) out.couponsAtPos = p.couponsAtPos;
  if (key === "receipts" && p.footer != null) out.receiptFooter = p.footer;
  if (key === "returns") {
    if (p.windowDays != null) out.returnWindowDays = p.windowDays;
    if (p.approvalOver != null) out.refundApprovalOver = toKobo(p.approvalOver as number);
    if (p.finalSale != null) out.finalSaleCategories = p.finalSale;
  }
  if (key === "cash") {
    if (p.defaultFloat != null) out.defaultFloat = toKobo(p.defaultFloat as number);
    if (p.blindClose != null) out.blindClose = p.blindClose;
    if (p.tolerance != null) out.cashTolerance = toKobo(p.tolerance as number);
  }
  if (key === "loyalty") {
    if (p.earnAtPos != null) out.earnLoyaltyAtPos = p.earnAtPos;
    if (p.redeemAtPos != null) out.redeemLoyaltyAtPos = p.redeemAtPos;
    if (p.minRedeem != null) out.minRedeemPoints = p.minRedeem;
  }
  if (key === "offline") {
    if (p.allowed != null) out.offlineAllowed = p.allowed;
    if (p.maxSale != null) out.offlineMaxSale = toKobo(p.maxSale as number);
    if (p.oversell != null) out.oversell = p.oversell;
    if (p.pickupsOffline != null) out.pickupsOffline = p.pickupsOffline;
  }
  if (key === "services") {
    if (p.layaway != null) out.layawayEnabled = p.layaway;
    if (p.minDepositPct != null) out.layawayMinDepositPct = p.minDepositPct;
    if (p.holdDays != null) out.layawayHoldDays = p.holdDays;
    if (p.cancelRefund != null) out.layawayCancelRefund = p.cancelRefund;
    if (p.alterations != null) out.alterationsEnabled = p.alterations;
    if (p.giftCards != null) out.giftCardsEnabled = p.giftCards;
    if (p.freeAlterationsOver != null) out.freeAlterationsOver = toKobo(p.freeAlterationsOver as number);
  }
  if (key === "payments" && p.points != null) out.redeemLoyaltyAtPos = p.points;
  return out;
}