"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";

async function assertCanModerateTopicNote(topicId: string) {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or HOD can review lesson plans."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const [{ data: teacher }, { data: topic }] = await Promise.all([
    admin.from("teacher_profiles").select("staff_role, subjects_taught").eq("id", id).single(),
    admin.from("curriculum_topics").select("subject_id").eq("id", topicId).single(),
  ]);
  if (
    teacher?.staff_role !== "hod" ||
    !topic ||
    !teacher.subjects_taught?.includes(topic.subject_id)
  ) {
    throw new Error("Only the HOD assigned to this subject can review this lesson plan.");
  }
  return { actorId: id };
}

async function setNoteModerationStatus(
  noteId: string,
  decision: "approved" | "rejected",
  reviewNote?: string
) {
  const admin = createAdminClient();
  const { data: note } = await admin
    .from("topic_notes")
    .select("topic_id, status, curriculum_topics(title)")
    .eq("id", noteId)
    .single();

  if (!note) throw new Error("Lesson plan note not found.");
  if (note.status !== "published") {
    throw new Error("Only a published note can be reviewed — drafts aren't submitted yet.");
  }

  const { actorId } = await assertCanModerateTopicNote(note.topic_id);

  const { error } = await admin
    .from("topic_notes")
    .update({ moderation_status: decision })
    .eq("id", noteId);

  if (error) throwDbError(error);

  await writeAuditLog({
    entityType: "topic_note",
    entityId: noteId,
    action: decision === "approved" ? "lesson_plan_approved" : "lesson_plan_rejected",
    actorId,
    metadata: {
      topic_id: note.topic_id,
      topic_title: note.curriculum_topics?.title,
      review_note: reviewNote ?? null,
    },
  });

  revalidatePath("/dashboard/teacher/notes");
  revalidatePath(`/dashboard/teacher/notes/${note.topic_id}`);
  revalidatePath(`/dashboard/student/topics/${note.topic_id}`);
}

export async function approveLessonPlan(noteId: string) {
  await setNoteModerationStatus(noteId, "approved");
}

export async function rejectLessonPlan(noteId: string, reviewNote?: string) {
  await setNoteModerationStatus(noteId, "rejected", reviewNote);
}
