"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";

export async function saveReportCardRemark(input: {
  studentId: string;
  term: number;
  academicYear: string;
  classTeacherRemark?: string;
  adminRemark?: string;
}) {
  const { id } = await assertRole(["admin", "teacher"], "Only staff can add report card remarks.");

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
    },
    { onConflict: "student_id,term,academic_year" }
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/report-card`);
  revalidatePath("/dashboard/student/report-card");
}
