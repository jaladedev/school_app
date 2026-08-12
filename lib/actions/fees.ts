"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole, getAuthenticatedUser } from "@/lib/actions/authGuards";
import type { EducationLevel, PaymentMethod } from "@/types/database";
import { serverEnv } from "@/lib/env.server";
import { computeInvoiceStatus } from "@/lib/invoiceStatus";
import { throwDbError } from "@/lib/errors/db";

/**
 * Admin or the bursar. The DB already grants staff_role: "bursar" write
 * access to fee_structures/invoices/payments (is_bursar() policies) —
 * this mirrors that at the app layer instead of leaving it as dead RLS
 * that bursar accounts could never actually reach, since every action
 * here used the admin client and was previously hard-locked to admin
 * only.
 */
export async function assertCanManageFees(errorMessage: string): Promise<{ id: string }> {
  const { id, role } = await assertRole(["admin", "teacher"], errorMessage);
  if (role === "admin") return { id };

  const admin = createAdminClient();
  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (teacherProfile?.staff_role !== "bursar") {
    throw new Error(errorMessage);
  }
  return { id };
}

export async function createFeeStructure(input: {
  educationLevel: EducationLevel;
  levelNumber: number;
  term: number;
  academicYear: string;
  title: string;
  amountKobo: number;
  dueDate?: string;
}) {
  const { id } = await assertCanManageFees("Only an admin or the bursar can manage fees.");
  const admin = createAdminClient();

  const { error } = await admin.from("fee_structures").insert({
    education_level: input.educationLevel,
    level_number: input.levelNumber,
    term: input.term,
    academic_year: input.academicYear,
    title: input.title,
    amount_kobo: input.amountKobo,
    due_date: input.dueDate || null,
    created_by: id,
  });

  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/fees");
}

export async function generateInvoicesForClass(feeStructureId: string, classId: string) {
  await assertCanManageFees("Only an admin or the bursar can manage fees.");
  const admin = createAdminClient();

  const { data: feeStructure } = await admin
    .from("fee_structures")
    .select("*")
    .eq("id", feeStructureId)
    .single();

  if (!feeStructure) throw new Error("Fee structure not found.");

  const { data: students } = await admin
    .from("student_profiles")
    .select("id")
    .eq("class_id", classId);

  if (!students?.length) {
    return { created: 0 };
  }

  const { data: existingInvoices } = await admin
    .from("invoices")
    .select("student_id")
    .eq("fee_structure_id", feeStructureId);

  const existingIds = new Set((existingInvoices ?? []).map((i) => i.student_id));
  const toCreate = students.filter((s) => !existingIds.has(s.id));

  if (!toCreate.length) {
    return { created: 0 };
  }

  const { error } = await admin.from("invoices").insert(
    toCreate.map((s) => ({
      student_id: s.id,
      fee_structure_id: feeStructureId,
      term: feeStructure.term,
      academic_year: feeStructure.academic_year,
      total_amount_kobo: feeStructure.amount_kobo,
      status: "unpaid" as const,
    }))
  );

  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/fees");
  return { created: toCreate.length };
}

export async function recordPayment(input: {
  invoiceId: string;
  amountKobo: number;
  method: PaymentMethod;
  reference?: string;
}) {
  const { id } = await assertCanManageFees("Only an admin or the bursar can manage fees.");
  const admin = createAdminClient();

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
    p_verified_by: id,
    p_enforce_balance: true,
  });

  if (error) throwDbError(error);
  if (result?.[0]?.already_recorded) {
    throw new Error("A payment with this reference has already been recorded.");
  }

  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/student/fees");
}

export async function applyDiscount(invoiceId: string, discountKobo: number) {
  await assertCanManageFees("Only an admin or the bursar can manage fees.");

  if (!Number.isInteger(discountKobo) || discountKobo < 0) {
    throw new Error("Discount amount must be zero or a positive amount.");
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).single();

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.voided_at) throw new Error("This invoice has been voided and can't be discounted.");
  // Mirrors the DB's invoices_discount_not_exceeding_total CHECK constraint
  // with a message a bursar can actually act on, instead of surfacing the
  // raw constraint-violation error from Postgres.
  if (discountKobo > invoice.total_amount_kobo) {
    throw new Error("Discount can't be more than the invoice's total amount.");
  }

  const newStatus = computeInvoiceStatus(
    invoice.total_amount_kobo,
    discountKobo,
    invoice.amount_paid_kobo
  );

  const { error } = await admin
    .from("invoices")
    .update({ discount_kobo: discountKobo, status: newStatus })
    .eq("id", invoiceId);

  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/fees");
}

/**
 * Voids an invoice that shouldn't have existed (wrong student, duplicate
 * generation, wrong fee structure, etc.) — distinct from applyDiscount,
 * which is for a legitimate reduction/waiver of an amount actually owed.
 * A voided invoice drops out of balances, defaulters, and collection
 * totals entirely rather than showing as "paid" or a $0 discount.
 *
 * Blocked once any payment has landed on the invoice — reversing money
 * already collected needs a real refund/reversal flow, not a void.
 */
export async function voidInvoice(invoiceId: string, reason: string) {
  const { id } = await assertCanManageFees("Only an admin or the bursar can void an invoice.");
  const admin = createAdminClient();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("A reason is required to void an invoice.");
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("voided_at, amount_paid_kobo")
    .eq("id", invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.voided_at) throw new Error("This invoice has already been voided.");
  if (invoice.amount_paid_kobo > 0) {
    throw new Error(
      "This invoice already has a payment recorded — reverse or refund the payment before voiding."
    );
  }

  const { error } = await admin
    .from("invoices")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: id,
      void_reason: trimmedReason,
    })
    .eq("id", invoiceId)
    .is("voided_at", null);

  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/fees/invoices");
  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");
  revalidatePath("/dashboard/parent");
  revalidatePath("/dashboard/library/loans");
}

// ---------- Paystack (student-initiated, server-verified) ----------

// Called from the browser AFTER Paystack's inline popup reports success.
// The popup callback is NOT trusted on its own — this re-verifies the
// transaction directly with Paystack's API using the secret key (which
// never leaves the server), and only credits the invoice if that
// server-side check actually confirms a successful, correctly-sized
// payment. This is the same trust model a webhook would use, just
// triggered by the client instead of by Paystack calling back to you.
export async function verifyPaystackPayment(input: { reference: string; invoiceId: string }) {
  // getAuthenticatedUser() (authGuards.ts) handles the transient-network-
  // vs-actually-signed-out distinction that used to be duplicated here
  // inline -- worth calling out that it matters especially at this call
  // site, since a false "not signed in" here would wrongly reject a real
  // payment-verification attempt from a legitimately signed-in
  // student/parent during a network blip, mid-payment.
  const user = await getAuthenticatedUser();

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.voided_at) throw new Error("This invoice has been voided and can't accept payments.");

  // Who can trigger verification for this invoice:
  //  1. The student themselves — checked against auth.getUser()'s id,
  //     which is JWT-validated and can't be spoofed.
  //  2. A parent/guardian linked to this student via guardian_links —
  //     looked up with the admin client (bypasses RLS, reads ground
  //     truth) keyed off user.id, not a client-suppliable profile field.
  //     NOTE: guardian_links must itself be locked down with RLS so a
  //     parent can't insert their own link to an arbitrary student.
  //  3. An admin — verified via assertRole (service-role verified),
  //     never trusted off a session-scoped profile row. This stays a
  //     separate, stricter check rather than something like
  //     `profile.role === "admin"`.
  if (invoice.student_id !== user.id) {
    const { data: link } = await admin
      .from("guardian_links")
      .select("id")
      .eq("parent_id", user.id)
      .eq("student_id", invoice.student_id)
      .maybeSingle();

    if (!link) {
      await assertRole(["admin"], "You can't pay an invoice that isn't yours.");
    }
  }

  // Idempotency: if this reference was already recorded, don't credit
  // the invoice twice (e.g. the browser tab retrying after a network
  // blip, or the user re-triggering the same callback).
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id")
    .eq("reference", input.reference)
    .maybeSingle();

  if (existingPayment) {
    return { alreadyRecorded: true };
  }

  const secretKey = serverEnv.PAYSTACK_SECRET_KEY;

  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  const verifyData = await verifyResponse.json();

  if (!verifyResponse.ok || verifyData?.data?.status !== "success") {
    throw new Error("Payment could not be verified with Paystack.");
  }

  // Paystack amounts are already in kobo for NGN transactions, matching
  // this schema's convention — no conversion needed either direction.
  const paidAmountKobo: number = verifyData.data.amount;
  const { data: result, error } = await admin.rpc("record_invoice_payment", {
    p_invoice_id: input.invoiceId,
    p_amount_kobo: paidAmountKobo,
    p_method: "card",
    p_reference: input.reference,
    p_verified_by: null,
    p_enforce_balance: true,
  });

  if (error) throwDbError(error);

  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");
  revalidatePath("/dashboard/admin/fees/invoices");

  return { alreadyRecorded: result?.[0]?.already_recorded ?? false, amountKobo: paidAmountKobo };
}

/** Admin/bursar: message every guardian (or the student, if unlinked) of a
 *  still-owing invoice not already reminded in the last p_minDaysBetween days. */
export async function sendFeeReminders(minDaysBetween = 7) {
  await assertCanManageFees("Only an admin or the bursar can send fee reminders.");

  // Use the request-scoped client (not the admin client) so auth.uid()
  // inside send_fee_reminders() resolves to the caller — the RPC uses it
  // as the message sender_id.
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_fee_reminders", {
    p_min_days_between: minDaysBetween,
  });

  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/fees/invoices");

  return {
    remindersSent: data?.[0]?.reminders_sent ?? 0,
    invoicesConsidered: data?.[0]?.invoices_considered ?? 0,
  };
}
