import type { Permission } from "../data/types";

/** Map till UI permission keys → Nest `pos.*` permission strings. */
export const PERM_TO_API: Record<Permission, string> = {
  discount: "pos.discount",
  priceOverride: "pos.price_override",
  refund: "pos.refund",
  refundNoReceipt: "pos.refund_no_receipt",
  voidSale: "pos.void",
  cashMoves: "pos.cash_moves",
  openClose: "pos.open_close",
  stockAdjust: "pos.stock_adjust",
  viewReports: "pos.reports",
};

export function hasApiPerm(permissions: string[] | undefined, perm: Permission) {
  if (!permissions?.length) return false;
  return permissions.includes(PERM_TO_API[perm]) || permissions.includes("pos.manage");
}

export function mapStoreRole(role: string): "Cashier" | "Supervisor" | "Manager" {
  if (role === "store_manager" || role === "super_admin" || role === "ops_manager") return "Manager";
  if (role === "store_supervisor") return "Supervisor";
  return "Cashier";
}

export function toApiRole(role: "Cashier" | "Supervisor" | "Manager") {
  if (role === "Manager") return "store_manager";
  if (role === "Supervisor") return "store_supervisor";
  return "store_cashier";
}
