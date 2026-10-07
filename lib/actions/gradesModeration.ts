"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";
import { runAction, type ActionResult } from "@/lib/actionResult";

// HOD review is principal-level: any active HOD reviews every subject (see
// 20260921184114_hod_principal_wide_approval), so there's no per-subject check.
async function assertCanModerateGrades() {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or HOD can review grades."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };
  const { data: teacher } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (teacher?.staff_role !== "hod") {
    throw new Error("Only an admin or HOD can review grades.");
  }
  return { actorId: id };
}

function cleanReason(reason: string | undefined): string {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) throw new Error("Give the teacher a reason so they know what to fix.");
  return trimmed;
}

function revalidateGradePaths(assessmentId: string, studentId?: string) {
  revalidatePath("/dashboard/admin/grades");
  revalidatePath(`/dashboard/admin/grades/${assessmentId}`);
  revalidatePath("/dashboard/teacher/grades");
  revalidatePath(`/dashboard/teacher/grades/${assessmentId}`);
  revalidatePath(`/dashboard/teacher/grades/${assessmentId}/review`);
  revalidatePath("/dashboard/student/grades");
  if (studentId) revalidatePath(`/dashboard/admin/students/${studentId}/grades`);
}

async function reviewAssessment(
  assessmentId: string,
  decision: "approved" | "rejected",
  reason?: string
) {
  const { actorId } = await assertCanModerateGrades();
  const note = decision === "rejected" ? cleanReason(reason) : null;
  const admin = createAdminClient();

  const { error, count } = await admin
    .from("grades")
    .update(
      {
        moderation_status: decision,
        review_note: note,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("assessment_id", assessmentId)
    .eq("moderation_status", "pending");

  if (error) throwDbError(error);

  await writeAuditLog({
    entityType: "assessment",
    entityId: assessmentId,
    action: decision === "approved" ? "grades_bulk_approved" : "grades_bulk_rejected",
    actorId,
    metadata: { count: count ?? 0, review_note: note },
  });

  revalidateGradePaths(assessmentId);
  return { count: count ?? 0 };
}

async function reviewGrade(gradeId: string, decision: "approved" | "rejected", reason?: string) {
  const { actorId } = await assertCanModerateGrades();
  const note = decision === "rejected" ? cleanReason(reason) : null;
  const admin = createAdminClient();

  const { data: grade } = await admin
    .from("grades")
    .select("assessment_id, student_id, moderation_status")
    .eq("id", gradeId)
    .single();
  if (!grade) throw new Error("Grade not found.");

  const { error } = await admin
    .from("grades")
    .update({
      moderation_status: decision,
      review_note: note,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", gradeId);
  if (error) throwDbError(error);

  await writeAuditLog({
    entityType: "grade",
    entityId: gradeId,
    action: decision === "approved" ? "grade_approved" : "grade_rejected",
    actorId,
    metadata: {
      assessment_id: grade.assessment_id,
      student_id: grade.student_id,
      review_note: note,
    },
  });

  revalidateGradePaths(grade.assessment_id, grade.student_id);
}

export async function approveAssessmentGrades(
  assessmentId: string
): Promise<ActionResult<{ count: number }>> {
  return runAction(() => reviewAssessment(assessmentId, "approved"));
}

export async function rejectAssessmentGrades(
  assessmentId: string,
  reason: string
): Promise<ActionResult<{ count: number }>> {
  return runAction(() => reviewAssessment(assessmentId, "rejected", reason));
}

export async function approveSingleGrade(gradeId: string): Promise<ActionResult> {
  return runAction(() => reviewGrade(gradeId, "approved"));
}

export async function rejectSingleGrade(gradeId: string, reason: string): Promise<ActionResult> {
  return runAction(() => reviewGrade(gradeId, "rejected", reason));
}
