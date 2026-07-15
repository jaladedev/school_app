"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { AttendanceStatus, HomeworkStatus } from "@/types/database";

// ---------- Lessons ----------

export async function createLesson(input: {
  timetableEntryId: string;
  classId: string;
  lessonDate: string;
  topicId?: string;
  objectives?: string;
  homework?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can log lessons.");
  }

  const supabase = createClient();

  const { data: entry } = await supabase
    .from("timetable_entries")
    .select("teacher_id, class_id, classes(name, arm)")
    .eq("id", input.timetableEntryId)
    .single();

  if (!entry) {
    throw new Error("Timetable entry not found.");
  }

  if (entry.teacher_id !== profile.id) {
    const className = entry.classes?.name ?? "this class";
    throw new Error(`You aren't assigned to this period for ${className}.`);
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      timetable_entry_id: input.timetableEntryId,
      class_id: input.classId,
      teacher_id: profile.id,
      lesson_date: input.lessonDate,
      topic_id: input.topicId || null,
      objectives: input.objectives || null,
      homework: input.homework || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/teacher/attendance");
  return { lessonId: lesson.id };
}

export async function updateHomeworkStatus(lessonId: string, status: HomeworkStatus) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can update homework status.");
  }

  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("teacher_id")
    .eq("id", lessonId)
    .single();

  if (!lesson || lesson.teacher_id !== profile.id) {
    throw new Error("You aren't the teacher assigned to this lesson.");
  }

  const { error } = await supabase
    .from("lessons")
    .update({ homework_status: status })
    .eq("id", lessonId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/homework");
}

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

  const { data: lesson } = await supabase
    .from("lessons")
    .select("teacher_id, classes(name, arm)")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  if (lesson.teacher_id !== profile.id) {
    const className = lesson.classes?.name ?? "this class";
    throw new Error(`You aren't the teacher assigned to this lesson for ${className}.`);
  }

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

  const { data: assessment } = await supabase
    .from("assessments")
    .select("subject_id, class_id, subjects(name), classes(name, arm)")
    .eq("id", assessmentId)
    .single();

  if (!assessment) {
    throw new Error("Assessment not found.");
  }

  const { data: assignment } = await supabase
    .from("timetable_entries")
    .select("id")
    .eq("teacher_id", profile.id)
    .eq("subject_id", assessment.subject_id)
    .eq("class_id", assessment.class_id)
    .maybeSingle();

  if (!assignment) {
    const subjectName = assessment.subjects?.name ?? "this subject";
    const className = assessment.classes?.name ?? "this class";
    throw new Error(
      `You aren't assigned to teach ${subjectName} for ${className}, so you can't enter grades for it.`
    );
  }

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