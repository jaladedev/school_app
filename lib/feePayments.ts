import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDbError } from "@/lib/errors/db";
import type { Database, PaymentMethod } from "@/types/database";

// The service-role client, passed in by a server action under lib/actions/.
type AdminClient = SupabaseClient<Database>;

/**
 * Credits a payment to an invoice. No authorization here: every caller checks
 * who is allowed first (recordPayment and the transfer-claim confirmation each
 * make their own call to assertCanManageFees).
 *
 * Returns `alreadyRecorded: true` when a payment with the same reference exists,
 * so a repeated call is harmless.
 */
export async function recordInvoicePayment(
  admin: AdminClient,
  input: {
    invoiceId: string;
    amountKobo: number;
    method: PaymentMethod;
    reference?: string | null;
    verifiedBy: string;
  }
): Promise<{ alreadyRecorded: boolean }> {
  if (input.amountKobo <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("voided_at, total_amount_kobo, discount_kobo, amount_paid_kobo")
    .eq("id", input.invoiceId)
    .single();
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.voided_at) throw new Error("This invoice has been voided and can't accept payments.");

  const balanceKobo = invoice.total_amount_kobo - invoice.discount_kobo - invoice.amount_paid_kobo;
  if (input.amountKobo > balanceKobo) {
    throw new Error(
      `This payment (₦${(input.amountKobo / 100).toLocaleString("en-NG")}) is more than the ₦${(balanceKobo / 100).toLocaleString("en-NG")} still owed on this invoice.`
    );
  }

  const { data: result, error } = await admin.rpc("record_invoice_payment", {
    p_invoice_id: input.invoiceId,
    p_amount_kobo: input.amountKobo,
    p_method: input.method,
    p_reference: input.reference?.trim() || null,
    p_verified_by: input.verifiedBy,
    p_enforce_balance: true,
  });

  if (error) throwDbError(error);
  return { alreadyRecorded: Boolean(result?.[0]?.already_recorded) };
}
