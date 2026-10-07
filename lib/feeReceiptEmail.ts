import type { createAdminClient } from "@/lib/supabase/admin";
import { sendBulkEmail } from "@/lib/email";
import { formatKobo } from "@/types/database";
import { logger } from "@/lib/logger";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Emails every active, linked guardian a copy of a payment their child made
 * themselves. A student's Paystack receipt goes to the student's own
 * address, which for younger pupils a parent never sees -- this guarantees
 * the parent has a record of money leaving their child's card/account.
 *
 * Best-effort by design: the payment is already recorded by the time this
 * runs, so nothing here may throw into the caller. Returns how many copies
 * were sent (0 when there are no guardians with an email on file).
 */
export async function sendGuardianReceiptCopy({
  admin,
  studentId,
  invoiceId,
  amountKobo,
}: {
  admin: ReturnType<typeof createAdminClient>;
  studentId: string;
  invoiceId: string;
  amountKobo: number;
}): Promise<number> {
  try {
    const { data: links } = await admin
      .from("guardian_links")
      .select(
        "parent_id, profiles!guardian_links_parent_id_fkey(full_name, is_active, profile_contacts(email))"
      )
      .eq("student_id", studentId);

    const recipients = new Map<string, { email: string; name: string }>();
    for (const link of links ?? []) {
      const profile = link.profiles;
      const email = profile?.profile_contacts?.email;
      if (!profile?.is_active || !email) continue;
      recipients.set(link.parent_id as string, { email, name: profile.full_name });
    }
    if (recipients.size === 0) return 0;

    const [{ data: student }, { data: invoice }, { data: school }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", studentId).single(),
      admin
        .from("invoices")
        .select("total_amount_kobo, discount_kobo, amount_paid_kobo, fee_structures(title)")
        .eq("id", invoiceId)
        .single(),
      admin.from("school_settings").select("name").eq("id", 1).single(),
    ]);

    const studentName = student?.full_name ?? "Your child";
    const feeTitle = invoice?.fee_structures?.title ?? "school fees";
    const schoolName = school?.name ?? "the school";
    const balanceKobo = invoice
      ? Math.max(0, invoice.total_amount_kobo - invoice.discount_kobo - invoice.amount_paid_kobo)
      : null;

    const lines = [
      `${studentName} just paid ${formatKobo(amountKobo)} online towards ${feeTitle}.`,
      balanceKobo === null
        ? null
        : balanceKobo === 0
          ? "This invoice is now fully paid."
          : `Remaining balance on this invoice: ${formatKobo(balanceKobo)}.`,
      "You can view and print the full receipt from the Fees page in the school portal.",
    ].filter((l): l is string => l !== null);

    const html = `<div style="font-family: sans-serif;"><p><strong>Payment received — ${escapeHtml(
      schoolName
    )}</strong></p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>`;

    const result = await sendBulkEmail({
      recipients: [...recipients.values()],
      subject: `Payment received for ${studentName} — ${schoolName}`,
      html,
      text: lines.join("\n\n"),
    });

    if (result.failed.length) {
      logger.warn("sendGuardianReceiptCopy: some copies failed", {
        invoiceId,
        failed: result.failed.length,
      });
    }
    return result.sent;
  } catch (err) {
    logger.warn("sendGuardianReceiptCopy failed", { invoiceId, error: err });
    return 0;
  }
}
