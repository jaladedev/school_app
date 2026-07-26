"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

async function assertCanManageTransportFees(): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin, bursar, or transport officer can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (
    teacherProfile?.staff_role !== "bursar" &&
    teacherProfile?.staff_role !== "transport_officer"
  ) {
    throw new Error("Only an admin, bursar, or transport officer can do this.");
  }
  return { actorId: id };
}

export async function createTransportFeeStructure(input: {
  routeId: string;
  term: number;
  academicYear: string;
  amountKobo: number;
  title?: string;
  dueDate?: string;
}) {
  const { actorId } = await assertCanManageTransportFees();
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Amount must be a positive whole number of kobo.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("transport_fee_structures").insert({
    route_id: input.routeId,
    term: input.term,
    academic_year: input.academicYear,
    title: input.title?.trim() || "Transport Fee",
    amount_kobo: input.amountKobo,
    due_date: input.dueDate || null,
    created_by: actorId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
}

export async function voidTransportFeeStructure(id: string) {
  const { actorId } = await assertCanManageTransportFees();
  const admin = createAdminClient();

  const { error } = await admin
    .from("transport_fee_structures")
    .update({ voided_at: new Date().toISOString(), voided_by: actorId })
    .eq("id", id)
    .is("voided_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
}

/**
 * Creates an invoice for every student currently assigned to the fee
 * structure's route who doesn't already have one for it — safe to call
 * more than once (e.g. after a new student joins the route mid-term)
 * since it only fills in the gap, never duplicates.
 */
export async function generateTransportInvoices(
  transportFeeStructureId: string
): Promise<{ created: number; alreadyInvoiced: number }> {
  await assertCanManageTransportFees();
  const admin = createAdminClient();

  const { data: feeStructure } = await admin
    .from("transport_fee_structures")
    .select("id, route_id, term, academic_year, amount_kobo, voided_at")
    .eq("id", transportFeeStructureId)
    .single();
  if (!feeStructure) throw new Error("Transport fee not found.");
  if (feeStructure.voided_at) throw new Error("This transport fee has been voided.");

  const { data: riders } = await admin
    .from("transport_assignments")
    .select("student_id")
    .eq("route_id", feeStructure.route_id)
    .is("unassigned_at", null);
  const riderIds = [...new Set((riders ?? []).map((r) => r.student_id))];

  const { data: existingInvoices } = await admin
    .from("invoices")
    .select("student_id")
    .eq("transport_fee_structure_id", transportFeeStructureId);
  const alreadyInvoicedIds = new Set((existingInvoices ?? []).map((i) => i.student_id));

  const toInvoice = riderIds.filter((id) => !alreadyInvoicedIds.has(id));

  if (toInvoice.length) {
    const { error } = await admin.from("invoices").insert(
      toInvoice.map((studentId) => ({
        student_id: studentId,
        transport_fee_structure_id: transportFeeStructureId,
        term: feeStructure.term,
        academic_year: feeStructure.academic_year,
        total_amount_kobo: feeStructure.amount_kobo,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/admin/fees");

  return { created: toInvoice.length, alreadyInvoiced: alreadyInvoicedIds.size };
}
