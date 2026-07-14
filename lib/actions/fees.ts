"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EducationLevel, PaymentMethod } from "@/types/database";

async function assertIsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Only an admin can manage fees.");
  }
  return profile;
}

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
  const profile = await assertIsAdmin();
  const supabase = createClient();

  const { error } = await supabase.from("fee_structures").insert({
    education_level: input.educationLevel,
    level_number: input.levelNumber,
    term: input.term,
    academic_year: input.academicYear,
    title: input.title,
    amount_kobo: input.amountKobo,
    due_date: input.dueDate || null,
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/fees");
}

// Generates one invoice per student in the given class for this fee
// structure. Uses upsert on the (student_id, fee_structure_id) unique
// constraint so re-running for a class that already has invoices
// doesn't create duplicates or wipe out recorded payments.
export async function generateInvoicesForClass(feeStructureId: string, classId: string) {
  await assertIsAdmin();
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
  const profile = await assertIsAdmin();
  const admin = createAdminClient();

  if (input.amountKobo <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");

  const { error: paymentError } = await admin.from("payments").insert({
    invoice_id: input.invoiceId,
    student_id: invoice.student_id,
    amount_kobo: input.amountKobo,
    method: input.method,
    reference: input.reference || null,
    verified_by: profile.id,
  });

  if (paymentError) throw new Error(paymentError.message);

  const newPaidKobo = invoice.amount_paid_kobo + input.amountKobo;
  const newStatus = computeStatus(invoice.total_amount_kobo, invoice.discount_kobo, newPaidKobo);

  const { error: invoiceError } = await admin
    .from("invoices")
    .update({ amount_paid_kobo: newPaidKobo, status: newStatus })
    .eq("id", input.invoiceId);

  if (invoiceError) throw new Error(invoiceError.message);

  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/student/fees");
}

export async function applyDiscount(invoiceId: string, discountKobo: number) {
  const profile = await assertIsAdmin();
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");

  const newStatus = computeStatus(invoice.total_amount_kobo, discountKobo, invoice.amount_paid_kobo);

  const { error } = await admin
    .from("invoices")
    .update({ discount_kobo: discountKobo, status: newStatus })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/fees");
}