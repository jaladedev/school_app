import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatestClaim } from "@/components/BankTransferPanel";
import {
  allowsCard,
  allowsTransfer,
  normalizePaymentMethods,
  readBankDetails,
  type BankDetails,
} from "@/lib/paymentClaims";

export interface PaymentOptions {
  showCard: boolean;
  /** Set only when transfer is switched on and the school's bank details are complete. */
  bank: BankDetails | null;
  latestClaimByInvoice: Record<string, LatestClaim>;
}

/**
 * What a payer sees on the Fees pages: which methods the school offers, its bank
 * details, and the newest transfer claim on each invoice. Reads with the signed-in
 * user's client, so row security decides which claims they can see.
 */
export async function loadPaymentOptions(
  supabase: SupabaseClient,
  invoiceIds: string[]
): Promise<PaymentOptions> {
  const { data: settings } = await supabase
    .from("school_settings")
    .select("payment_methods, bank_name, bank_account_name, bank_account_number")
    .eq("id", 1)
    .single();

  const methods = normalizePaymentMethods(settings?.payment_methods);
  const bank = allowsTransfer(methods) ? readBankDetails(settings) : null;

  const latestClaimByInvoice: Record<string, LatestClaim> = {};
  if (bank && invoiceIds.length > 0) {
    const { data: claims } = await supabase
      .from("payment_claims")
      .select("invoice_id, status, amount_kobo, sent_on, reject_reason, created_at")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false });

    for (const c of claims ?? []) {
      // Newest first, so the first row seen per invoice is the latest.
      if (latestClaimByInvoice[c.invoice_id]) continue;
      latestClaimByInvoice[c.invoice_id] = {
        status: c.status,
        amountKobo: c.amount_kobo,
        sentOn: c.sent_on,
        rejectReason: c.reject_reason,
      };
    }
  }

  return { showCard: allowsCard(methods), bank, latestClaimByInvoice };
}
