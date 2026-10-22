"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole, getAuthenticatedUser } from "@/lib/actions/authGuards";
import { assertNotReadOnly } from "@/lib/readOnlySession";
import { assertCanManageFees } from "@/lib/actions/fees";
import { recordInvoicePayment } from "@/lib/feePayments";
import { writeAuditLog } from "@/lib/audit";
import { sendTelegramMessage } from "@/lib/telegram";
import { throwDbError } from "@/lib/errors/db";
import { runAction } from "@/lib/actionResult";
import { STUDENT_PAYMENT_DISABLED_MESSAGE } from "@/lib/feeMessages";
import {
  allowsTransfer,
  claimPaymentReference,
  invoiceReference,
  normalizePaymentMethods,
  readBankDetails,
  validateClaimInput,
  validatePaymentSettings,
  type PaymentMethods,
} from "@/lib/paymentClaims";
import { formatKobo } from "@/types/database";

const FEE_STAFF_MESSAGE = "Only an admin or the bursar can handle transfer claims.";

function revalidateFeePages() {
  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/bursar/payment-claims");
  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");
}

/**
 * A parent or student says "I've sent it". Nothing is credited here: a bursar
 * checks the bank statement and confirms or rejects the claim.
 *
 * Deliberately has no license check: a school whose license has lapsed still
 * takes fee payments, the same as card payments and receipts.
 */
export async function submitPaymentClaim(input: {
  invoiceId: string;
  amountKobo: number;
  sentOn: string;
  senderName: string;
}) {
  return runAction(async () => {
    const user = await getAuthenticatedUser();
    // Writes with the service role: refuse a read-only support session.
    assertNotReadOnly(user);
    const admin = createAdminClient();

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, student_id, voided_at, total_amount_kobo, discount_kobo, amount_paid_kobo")
      .eq("id", input.invoiceId)
      .single();
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.voided_at)
      throw new Error("This invoice has been voided and can't accept payments.");

    // Who is paying: the student themself or a linked guardian. Admins and
    // bursars record payments directly instead of claiming them.
    let payer: "student" | "guardian";
    if (invoice.student_id === user.id) {
      payer = "student";
    } else {
      const { data: link } = await admin
        .from("guardian_links")
        .select("id")
        .eq("parent_id", user.id)
        .eq("student_id", invoice.student_id)
        .maybeSingle();
      if (!link) throw new Error("You can't pay an invoice that isn't yours.");
      payer = "guardian";
    }

    const { data: settings } = await admin
      .from("school_settings")
      .select(
        "payment_methods, bank_name, bank_account_name, bank_account_number, payment_notify_chat_id, student_online_payment_enabled"
      )
      .eq("id", 1)
      .single();

    if (
      !allowsTransfer(normalizePaymentMethods(settings?.payment_methods)) ||
      !readBankDetails(settings)
    ) {
      throw new Error("Bank transfer isn't available at your school.");
    }
    if (payer === "student" && settings?.student_online_payment_enabled === false) {
      throw new Error(STUDENT_PAYMENT_DISABLED_MESSAGE);
    }

    const balanceKobo =
      invoice.total_amount_kobo - invoice.discount_kobo - invoice.amount_paid_kobo;
    if (balanceKobo <= 0) throw new Error("This invoice is already fully paid.");

    const problem = validateClaimInput({
      amountKobo: input.amountKobo,
      balanceKobo,
      sentOn: input.sentOn,
      senderName: input.senderName,
    });
    if (problem) throw new Error(problem);

    const { data: open } = await admin
      .from("payment_claims")
      .select("id")
      .eq("invoice_id", invoice.id)
      .eq("status", "pending")
      .maybeSingle();
    if (open) {
      throw new Error("A transfer for this invoice is already waiting for the school to confirm.");
    }

    const reference = invoiceReference(invoice.id);
    const { data: claim, error } = await admin
      .from("payment_claims")
      .insert({
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        claimed_by: user.id,
        amount_kobo: input.amountKobo,
        sent_on: input.sentOn,
        sender_name: input.senderName.trim(),
        reference,
      })
      .select("id")
      .single();
    if (error) {
      // The unique index closes the race between two parents submitting together.
      if (error.code === "23505") {
        throw new Error(
          "A transfer for this invoice is already waiting for the school to confirm."
        );
      }
      throwDbError(error);
    }

    const { data: student } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", invoice.student_id)
      .single();

    await sendTelegramMessage(settings?.payment_notify_chat_id, [
      "Transfer claim waiting for confirmation",
      `Student: ${student?.full_name ?? "Unknown"}`,
      `Amount: ${formatKobo(input.amountKobo)}`,
      `Sent on: ${input.sentOn} by ${input.senderName.trim()}`,
      `Narration code: ${reference}`,
      "Check your bank statement, then confirm it under Payment claims.",
    ]);

    await writeAuditLog({
      entityType: "payment_claim",
      entityId: claim!.id,
      action: "submitted",
      actorId: user.id,
      metadata: { invoiceId: invoice.id, amountKobo: input.amountKobo, reference },
    });

    revalidateFeePages();
    return { reference };
  });
}

/**
 * Confirms a claim after the bursar has seen the money arrive. Credits the
 * invoice through the same function as every other payment (method
 * bank_transfer). Works when the school's license has lapsed.
 *
 * Safe to repeat: the payment reference is unique to the claim, so a retry after
 * a half-finished confirm credits nothing twice and just finishes the claim.
 */
export async function confirmPaymentClaim(input: { claimId: string; amountKobo?: number }) {
  return runAction(async () => {
    const { id } = await assertCanManageFees(FEE_STAFF_MESSAGE, { allowWhenExpired: true });
    const admin = createAdminClient();

    const { data: claim } = await admin
      .from("payment_claims")
      .select("id, invoice_id, amount_kobo, status")
      .eq("id", input.claimId)
      .single();
    if (!claim) throw new Error("Claim not found.");
    if (claim.status !== "pending") throw new Error("This claim has already been dealt with.");

    const amountKobo = input.amountKobo ?? claim.amount_kobo;
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new Error("Enter the amount that reached the account.");
    }

    const reference = claimPaymentReference(claim.id);
    await recordInvoicePayment(admin, {
      invoiceId: claim.invoice_id,
      amountKobo,
      method: "bank_transfer",
      reference,
      verifiedBy: id,
    });

    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("reference", reference)
      .single();
    if (!payment) throw new Error("The payment was recorded but could not be found. Try again.");

    const { data: updated, error } = await admin
      .from("payment_claims")
      .update({
        status: "confirmed",
        confirmed_amount_kobo: amountKobo,
        decided_by: id,
        decided_at: new Date().toISOString(),
        payment_id: payment.id,
      })
      .eq("id", claim.id)
      .eq("status", "pending")
      .select("id");
    if (error) throwDbError(error);
    if (!updated?.length) throw new Error("This claim has already been dealt with.");

    await writeAuditLog({
      entityType: "payment_claim",
      entityId: claim.id,
      action: "confirmed",
      actorId: id,
      metadata: { invoiceId: claim.invoice_id, amountKobo, claimedKobo: claim.amount_kobo },
    });

    revalidateFeePages();
  });
}

/** Rejects a claim when no matching money arrived. A reason is required and shown to the payer. */
export async function rejectPaymentClaim(input: { claimId: string; reason: string }) {
  return runAction(async () => {
    const { id } = await assertCanManageFees(FEE_STAFF_MESSAGE, { allowWhenExpired: true });
    const reason = input.reason.trim();
    if (!reason) throw new Error("Give a reason so the payer knows what to do next.");
    if (reason.length > 300) throw new Error("Keep the reason under 300 characters.");

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("payment_claims")
      .update({
        status: "rejected",
        reject_reason: reason,
        decided_by: id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.claimId)
      .eq("status", "pending")
      .select("id, invoice_id");
    if (error) throwDbError(error);
    if (!updated?.length) throw new Error("This claim has already been dealt with.");

    await writeAuditLog({
      entityType: "payment_claim",
      entityId: input.claimId,
      action: "rejected",
      actorId: id,
      metadata: { invoiceId: updated[0].invoice_id, reason },
    });

    revalidateFeePages();
  });
}

/** Which payment methods parents see, the school's bank details, and the Telegram chat. */
export async function savePaymentSettings(input: {
  paymentMethods: PaymentMethods;
  bankName: string;
  accountName: string;
  accountNumber: string;
  notifyChatId: string;
}) {
  return runAction(async () => {
    await assertRole(["admin"], "Only an admin can update school settings.");

    const paymentMethods = normalizePaymentMethods(input.paymentMethods);
    const problem = validatePaymentSettings({ ...input, paymentMethods });
    if (problem) throw new Error(problem);

    const supabase = createClient();
    const { error } = await supabase
      .from("school_settings")
      .update({
        payment_methods: paymentMethods,
        bank_name: input.bankName.trim() || null,
        bank_account_name: input.accountName.trim() || null,
        bank_account_number: input.accountNumber.trim() || null,
        payment_notify_chat_id: input.notifyChatId.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throwDbError(error);

    revalidatePath("/dashboard/admin/settings");
    revalidateFeePages();
  });
}
