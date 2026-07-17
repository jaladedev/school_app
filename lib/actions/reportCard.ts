"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export async function saveReportCardRemark(input: {
  studentId: string;
  term: number;
  academicYear: string;
  classTeacherRemark?: string;
  adminRemark?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) {
    throw new Error("Only staff can add report card remarks.");
  }

  const supabase = createClient();

  const { error } = await supabase.from("report_card_remarks").upsert(
    {
      student_id: input.studentId,
      term: input.term,
      academic_year: input.academicYear,
      class_teacher_remark: input.classTeacherRemark,
      admin_remark: input.adminRemark,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,term,academic_year" }
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/report-card`);
}
