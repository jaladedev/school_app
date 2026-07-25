import type { InvoiceStatus } from "@/types/database";

export function computeInvoiceStatus(
  totalKobo: number,
  discountKobo: number,
  paidKobo: number
): InvoiceStatus {
  const owed = totalKobo - discountKobo;
  // Nothing owed (e.g. a full discount/waiver) is "paid" even if nothing
  // was ever actually paid — otherwise a waived invoice would still show
  // as "unpaid" and keep surfacing on the defaulters export.
  if (owed <= 0) return "paid";
  if (paidKobo <= 0) return "unpaid";
  if (paidKobo >= owed) return "paid";
  return "partial";
}
