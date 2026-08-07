"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

async function assertCanManageHostelFees(hostelId: string): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or that hostel's house parent can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: hostel } = await admin
    .from("hostels")
    .select("house_parent_id")
    .eq("id", hostelId)
    .single();
  if (hostel?.house_parent_id !== id) {
    throw new Error("Only an admin or that hostel's house parent can do this.");
  }
  return { actorId: id };
}

export async function createHostelFeeStructure(input: {
  hostelId: string;
  term: number;
  academicYear: string;
  amountKobo: number;
  title?: string;
  dueDate?: string;
}) {
  const { actorId } = await assertCanManageHostelFees(input.hostelId);
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Amount must be a positive whole number of kobo.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("hostel_fee_structures").insert({
    hostel_id: input.hostelId,
    term: input.term,
    academic_year: input.academicYear,
    title: input.title?.trim() || "Hostel Fee",
    amount_kobo: input.amountKobo,
    due_date: input.dueDate || null,
    created_by: actorId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/hostels");
  revalidatePath("/dashboard/hostels");
}

export async function voidHostelFeeStructure(id: string, hostelId: string) {
  const { actorId } = await assertCanManageHostelFees(hostelId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("hostel_fee_structures")
    .update({ voided_at: new Date().toISOString(), voided_by: actorId })
    .eq("id", id)
    .is("voided_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/hostels");
  revalidatePath("/dashboard/hostels");
}

/**
 * Creates an invoice for every student currently assigned to a room in
 * the fee structure's hostel who doesn't already have one for it — safe
 * to call more than once, same as generateTransportInvoices.
 */
export async function generateHostelInvoices(
  hostelFeeStructureId: string
): Promise<{ created: number; alreadyInvoiced: number }> {
  // Authorize BEFORE touching the DB for anything sensitive -- this used
  // to read the fee structure (via the service-role admin client, which
  // bypasses RLS) first and only check permissions afterward. Nothing in
  // that data was ever returned to an unauthorized caller, so it wasn't
  // a live leak, but it's the wrong order on principle: an unauthorized
  // request shouldn't cause a real read against hostel-fee data at all,
  // and every other fee-management action in this codebase (see
  // installments.ts's createOrReplaceInstallmentPlan) authorizes first.
  // assertRole alone can't do the whole check here (house-parent-of-this-
  // specific-hostel isn't a role), so a role gate happens up front and
  // the hostel-scoped part happens right after we have hostel_id.
  await assertRole(
    ["admin", "teacher"],
    "Only an admin or that hostel's house parent can do this."
  );

  const admin = createAdminClient();

  const { data: feeStructure } = await admin
    .from("hostel_fee_structures")
    .select("id, hostel_id, term, academic_year, amount_kobo, voided_at")
    .eq("id", hostelFeeStructureId)
    .single();
  if (!feeStructure) throw new Error("Hostel fee not found.");

  await assertCanManageHostelFees(feeStructure.hostel_id);
  if (feeStructure.voided_at) throw new Error("This hostel fee has been voided.");

  const { data: rooms } = await admin
    .from("hostel_rooms")
    .select("id")
    .eq("hostel_id", feeStructure.hostel_id);
  const roomIds = (rooms ?? []).map((r) => r.id);

  const { data: residents } = roomIds.length
    ? await admin
        .from("hostel_assignments")
        .select("student_id")
        .in("room_id", roomIds)
        .is("unassigned_at", null)
    : { data: [] };
  const residentIds = [...new Set((residents ?? []).map((r) => r.student_id))];

  const { data: existingInvoices } = await admin
    .from("invoices")
    .select("student_id")
    .eq("hostel_fee_structure_id", hostelFeeStructureId);
  const alreadyInvoicedIds = new Set((existingInvoices ?? []).map((i) => i.student_id));

  const toInvoice = residentIds.filter((id) => !alreadyInvoicedIds.has(id));

  if (toInvoice.length) {
    const { error } = await admin.from("invoices").insert(
      toInvoice.map((studentId) => ({
        student_id: studentId,
        hostel_fee_structure_id: hostelFeeStructureId,
        term: feeStructure.term,
        academic_year: feeStructure.academic_year,
        total_amount_kobo: feeStructure.amount_kobo,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/admin/hostels");
  revalidatePath("/dashboard/admin/fees");

  return { created: toInvoice.length, alreadyInvoiced: alreadyInvoicedIds.size };
}
