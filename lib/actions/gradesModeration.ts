"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";

async function assertCanModerateAssessment(assessmentId: string) {
  const { id } = await assertRole(["admin", "teacher"], "Only an admin or HOD can approve grades.");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };
  const { data: teacher } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
    if (teacher?.staff_role !== "hod") {
    throw new Error("Only an admin or HOD can approve grades.");
  }
  return { actorId: id };
}

export async function approveAssessmentGrades(assessmentId: string) {
  const { actorId } = await assertCanModerateAssessment(assessmentId);
  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from("grades")
    .update({ moderation_status: "approved" })
    .eq("assessment_id", assessmentId)
    .eq("moderation_status", "pending");

  if (error) throwDbError(error);

  await writeAuditLog({
    entityType: "assessment",
    entityId: assessmentId,
    action: "grades_bulk_approved",
    actorId,
    metadata: { approved_count: count ?? 0 },
  });

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
  const { actorId } = await assertCanModerateAssessment(grade.assessment_id);

  const { error } = await admin
    .from("grades")
    .update({ moderation_status: "approved" })
    .eq("id", gradeId);

  if (error) throwDbError(error);

  await writeAuditLog({
    entityType: "grade",
    entityId: gradeId,
    action: "grade_approved",
    actorId,
    metadata: { assessment_id: grade.assessment_id, student_id: grade.student_id },
  });

  revalidatePath("/dashboard/admin/grades");
  revalidatePath("/dashboard/student/grades");
  if (grade) {
    revalidatePath(`/dashboard/teacher/grades/${grade.assessment_id}`);
    revalidatePath(`/dashboard/admin/students/${grade.student_id}/grades`);
  }
}
