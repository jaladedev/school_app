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
  revalidatePath("/dashboard/teacher/attendance");
  for (const studentId of new Set(records.map((r) => r.studentId))) {
    revalidatePath(`/dashboard/admin/students/${studentId}/attendance`);
  }
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
  revalidatePath("/dashboard/admin/grades");
  revalidatePath(`/dashboard/admin/students/${studentId}/grades`);
  revalidatePath("/dashboard/student/grades");
}

export async function importGrades(
  assessmentId: string,
  entries: { admissionNo: string; score: number; remark?: string }[]
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") throw new Error("Only teachers can import grades.");
  if (!entries.length) throw new Error("Add at least one grade row to import.");

  const supabase = createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("subject_id, class_id, max_score")
    .eq("id", assessmentId)
    .single();

  if (!assessment) throw new Error("Assessment not found.");

  const { data: assignment } = await supabase
    .from("timetable_entries")
    .select("id")
    .eq("teacher_id", profile.id)
    .eq("subject_id", assessment.subject_id)
    .eq("class_id", assessment.class_id)
    .maybeSingle();

  if (!assignment) throw new Error("You aren't assigned to this assessment's class and subject.");

  const admissionNumbers = entries.map((entry) => entry.admissionNo.trim());
  if (admissionNumbers.some((number) => !number))
    throw new Error("Every row needs an admission number.");
  if (new Set(admissionNumbers).size !== admissionNumbers.length) {
    throw new Error("Each admission number may only appear once in an import.");
  }
  if (
    entries.some(
      (entry) =>
        !Number.isFinite(entry.score) || entry.score < 0 || entry.score > assessment.max_score
    )
  ) {
    throw new Error(`Scores must be between 0 and ${assessment.max_score}.`);
  }

  const { data: roster } = await supabase
    .from("student_profiles")
    .select("id, admission_no")
    .eq("class_id", assessment.class_id)
    .in("admission_no", admissionNumbers);

  const studentByAdmission = new Map(
    (roster ?? []).map((student) => [student.admission_no, student.id])
  );
  const unknown = admissionNumbers.filter((number) => !studentByAdmission.has(number));
  if (unknown.length)
    throw new Error(`No student in this class has admission number: ${unknown.join(", ")}.`);

  const { error } = await supabase.from("grades").upsert(
    entries.map((entry) => ({
      assessment_id: assessmentId,
      student_id: studentByAdmission.get(entry.admissionNo.trim())!,
      score: entry.score,
      remark: entry.remark?.trim() || null,
      graded_by: profile.id,
    })),
    { onConflict: "assessment_id,student_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/teacher/grades/${assessmentId}`);
  revalidatePath("/dashboard/admin/grades");
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
