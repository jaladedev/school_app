"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

async function assertCanModerateAssessment(assessmentId: string) {
  const { id } = await assertRole(["admin", "teacher"], "Only an admin or HOD can approve grades.");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return;
  const [{ data: teacher }, { data: assessment }] = await Promise.all([
    admin.from("teacher_profiles").select("staff_role, subjects_taught").eq("id", id).single(),
    admin.from("assessments").select("subject_id").eq("id", assessmentId).single(),
  ]);
  if (
    teacher?.staff_role !== "hod" ||
    !assessment ||
    !teacher.subjects_taught?.includes(assessment.subject_id)
  ) {
    throw new Error("Only the HOD assigned to this subject can approve these grades.");
  }
}

export async function approveAssessmentGrades(assessmentId: string) {
  await assertCanModerateAssessment(assessmentId);
  const supabase = createAdminClient();

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
  const admin = createAdminClient();
  const { data: grade } = await admin
    .from("grades")
    .select("assessment_id, student_id")
    .eq("id", gradeId)
    .single();

  if (!grade) throw new Error("Grade not found.");
  await assertCanModerateAssessment(grade.assessment_id);

  const { error } = await admin
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
