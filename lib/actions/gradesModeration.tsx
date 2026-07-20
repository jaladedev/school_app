"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

async function assertIsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Only an admin can approve grades.");
  }
}

export async function approveAssessmentGrades(assessmentId: string) {
  await assertIsAdmin();
  const supabase = createClient();

  const { error, count } = await supabase
    .from("grades")
    .update({ moderation_status: "approved" })
    .eq("assessment_id", assessmentId)
    .eq("moderation_status", "pending");

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/grades");
  revalidatePath(`/dashboard/teacher/grades/${assessmentId}`);
  revalidatePath("/dashboard/student/grades");
  return { count };
}

export async function approveSingleGrade(gradeId: string) {
  await assertIsAdmin();
  const supabase = createClient();

  const { data: grade } = await supabase
    .from("grades")
    .select("assessment_id, student_id")
    .eq("id", gradeId)
    .single();

  const { error } = await supabase
    .from("grades")
    .update({ moderation_status: "approved" })
    .eq("id", gradeId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/grades");
  revalidatePath("/dashboard/student/grades");
  if (grade) {
    revalidatePath(`/dashboard/teacher/grades/${grade.assessment_id}`);
    revalidatePath(`/dashboard/admin/students/${grade.student_id}/grades`);
  }
}
