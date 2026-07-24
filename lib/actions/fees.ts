"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import type { EducationLevel, PaymentMethod } from "@/types/database";
import { serverEnv } from "@/lib/env.server";

function computeStatus(totalKobo: number, discountKobo: number, paidKobo: number) {
  const owed = totalKobo - discountKobo;
  if (paidKobo <= 0) return "unpaid" as const;
  if (paidKobo >= owed) return "paid" as const;
  return "partial" as const;
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
  const { id } = await assertRole(["admin"], "Only an admin can manage fees.");
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

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/fees");
}

export async function generateInvoicesForClass(feeStructureId: string, classId: string) {
  await assertRole(["admin"], "Only an admin can manage fees.");
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

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/fees");
  return { created: toCreate.length };
}

export async function recordPayment(input: {
  invoiceId: string;
  amountKobo: number;
  method: PaymentMethod;
  reference?: string;
}) {
  const { id } = await assertRole(["admin"], "Only an admin can manage fees.");
  const admin = createAdminClient();

  if (input.amountKobo <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const { data: result, error } = await admin.rpc("record_invoice_payment", {
    p_invoice_id: input.invoiceId,
    p_amount_kobo: input.amountKobo,
    p_method: input.method,
    p_reference: input.reference?.trim() || null,
    p_verified_by: id,
    p_enforce_balance: false,
  });

  if (error) throw new Error(error.message);
  if (result?.[0]?.already_recorded) {
    throw new Error("A payment with this reference has already been recorded.");
  }

  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/student/fees");
}

export async function applyDiscount(invoiceId: string, discountKobo: number) {
  await assertRole(["admin"], "Only an admin can manage fees.");
  const admin = createAdminClient();

  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).single();

  if (!invoice) throw new Error("Invoice not found.");

  const newStatus = computeStatus(
    invoice.total_amount_kobo,
    discountKobo,
    invoice.amount_paid_kobo
  );

  const { error } = await admin
    .from("invoices")
    .update({ discount_kobo: discountKobo, status: newStatus })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/fees");
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");

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

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");
  revalidatePath("/dashboard/admin/fees/invoices");

  return { alreadyRecorded: result?.[0]?.already_recorded ?? false, amountKobo: paidAmountKobo };
}
