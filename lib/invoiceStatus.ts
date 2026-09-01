import type { InvoiceStatus } from "@/types/database";

export function computeInvoiceStatus(
  totalKobo: number,
  discountKobo: number,
  paidKobo: number
): InvoiceStatus {
  const owed = totalKobo - discountKobo;
  // Nothing owed (e.g. a full discount/waiver) is "paid" even if nothing
  // was ever actually paid — otherwise a waived invoice would still show
  // as "unpaid" and keep surfacing on the defaulters export. The DB/filter
  // enum stays 3-valued ("unpaid" | "partial" | "paid") on purpose — see
  // getInvoiceStatusLabel below for the display-only distinction between
  // "paid via money" and "paid via waiver".
  if (owed <= 0) return "paid";
  if (paidKobo <= 0) return "unpaid";
  if (paidKobo >= owed) return "paid";
  return "partial";
}

// Display label for an invoice status badge. Separate from
// computeInvoiceStatus's return value (which stays "paid" for filtering,
// exports, and the defaulters query) because a bursar reading "Paid" on an
// invoice where paidKobo is 0 reasonably assumes money changed hands. When
// the zero balance came entirely from a discount/waiver instead, label it
// "Waived" so it isn't mistaken for a collected payment.
export function getInvoiceStatusLabel(
  status: InvoiceStatus,
  paidKobo: number,
  owedKobo: number
): string {
  if (status === "paid" && paidKobo <= 0 && owedKobo <= 0) return "Waived";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
