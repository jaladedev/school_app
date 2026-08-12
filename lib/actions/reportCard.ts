"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";
import { throwDbError } from "@/lib/errors/db";

export async function saveReportCardRemark(input: {
  studentId: string;
  term: number;
  academicYear: string;
  classTeacherRemark?: string;
  adminRemark?: string;
}) {
  const { id, role } = await assertRole(
    ["admin", "teacher"],
    "Only staff can add report card remarks."
  );

  // The admin remark (head teacher's remark) is reserved for admins only.
  // The UI already restricts the form to the admin dashboard, but the
  // server action must enforce this independently.
  if (role !== "admin" && input.adminRemark !== undefined) {
    throw new Error("Only an admin can write the head teacher's remark.");
  }

  const supabase = createClient();

  const { error } = await supabase.from("report_card_remarks").upsert(
    {
      student_id: input.studentId,
      term: input.term,
      academic_year: input.academicYear,
      class_teacher_remark: input.classTeacherRemark,
      admin_remark: input.adminRemark,
      updated_by: id,
      updated_at: new Date().toISOString(),
      // Any edit — including an admin's own — reverts to pending so an
      // edited card isn't silently visible without re-approval.
      moderation_status: "pending",
    },
    { onConflict: "student_id,term,academic_year" }
  );

  if (error) throwDbError(error);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/report-card`);
  revalidatePath("/dashboard/student/report-card");
  revalidatePath("/dashboard/parent/report-card");
}

export async function setReportCardApproval(input: {
  studentId: string;
  term: number;
  academicYear: string;
  approved: boolean;
}) {
  const { id } = await assertRole(["admin"], "Only an admin can approve a report card.");

  const supabase = createClient();

  // Don't upsert — approving a non-existent remark row would create an
  // empty one, making a mostly-blank report card visible to the student.
  const { data: existing, error: fetchError } = await supabase
    .from("report_card_remarks")
    .select("id")
    .eq("student_id", input.studentId)
    .eq("term", input.term)
    .eq("academic_year", input.academicYear)
    .maybeSingle();

  if (fetchError) throwDbError(fetchError);
  if (!existing) {
    throw new Error(
      "Add a class teacher's or head teacher's remark before approving this report card."
    );
  }

  const { error } = await supabase
    .from("report_card_remarks")
    .update({
      moderation_status: input.approved ? "approved" : "pending",
      approved_by: input.approved ? id : null,
      approved_at: input.approved ? new Date().toISOString() : null,
    })
    .eq("id", existing.id);

  if (error) throwDbError(error);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/report-card`);
  revalidatePath("/dashboard/student/report-card");
  revalidatePath("/dashboard/parent/report-card");
}
