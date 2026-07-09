"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

// ---------- Attendance ----------

export async function markAttendance(
  lessonId: string,
  records: { studentId: string; status: AttendanceStatus }[]
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can mark attendance.");
  }

  const supabase = createClient();

  const rows = records.map((r) => ({
    lesson_id: lessonId,
    student_id: r.studentId,
    status: r.status,
    marked_by: profile.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "lesson_id,student_id" });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/teacher/attendance/${lessonId}`);
}

// ---------- Grades ----------

export async function saveGrade(
  assessmentId: string,
  studentId: string,
  score: number,
  remark?: string
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can enter grades.");
  }

  const supabase = createClient();

  const { error } = await supabase.from("grades").upsert(
    {
      assessment_id: assessmentId,
      student_id: studentId,
      score,
      remark: remark ?? null,
      graded_by: profile.id,
    },
    { onConflict: "assessment_id,student_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/teacher/grades/${assessmentId}`);
}

// ---------- Note authoring ----------

export async function saveTopicNote(
  topicId: string,
  content: string,
  status: "draft" | "published",
  existingNoteId?: string
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can author notes.");
  }

  const supabase = createClient();

  if (existingNoteId) {
    const { error } = await supabase
      .from("topic_notes")
      .update({ content, status, updated_at: new Date().toISOString() })
      .eq("id", existingNoteId);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("topic_notes").insert({
      topic_id: topicId,
      author_id: profile.id,
      content,
      status,
    });

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/teacher/notes/${topicId}`);
}
