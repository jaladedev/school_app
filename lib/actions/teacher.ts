"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssessmentType, AttendanceStatus, HomeworkStatus, ResourceType } from "@/types/database";

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

  if (entry.class_id !== input.classId) {
    throw new Error("Class doesn't match this timetable entry.");
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

// ---------- Assessments ----------

async function assertTeacherAssignedTo(
  supabase: ReturnType<typeof createClient>,
  teacherId: string,
  subjectId: string,
  classId: string
) {
  const { data: assignment } = await supabase
    .from("timetable_entries")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) {
    throw new Error("You aren't assigned to teach this subject for this class.");
  }
}

export async function createStandardAssessmentSet(input: {
  subjectId: string;
  classId: string;
  term: number;
  academicYear: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can create assessments.");
  }

  const supabase = createClient();
  await assertTeacherAssignedTo(supabase, profile.id, input.subjectId, input.classId);

  const STANDARD_ASSESSMENTS = [
    { title: "1st CA", max_score: 20, assessment_type: "first_ca" as const },
    { title: "2nd CA", max_score: 20, assessment_type: "second_ca" as const },
    { title: "Exam", max_score: 60, assessment_type: "exam" as const },
  ];

  const { data: existing } = await supabase
    .from("assessments")
    .select("assessment_type")
    .eq("subject_id", input.subjectId)
    .eq("class_id", input.classId)
    .eq("term", input.term)
    .eq("academic_year", input.academicYear);

  const existingTypes = new Set((existing ?? []).map((a) => a.assessment_type));
  const toCreate = STANDARD_ASSESSMENTS.filter((a) => !existingTypes.has(a.assessment_type));

  if (!toCreate.length) {
    return { created: [] as string[] };
  }

  const { error } = await supabase.from("assessments").insert(
    toCreate.map((a) => ({
      subject_id: input.subjectId,
      class_id: input.classId,
      title: a.title,
      assessment_type: a.assessment_type,
      max_score: a.max_score,
      term: input.term,
      academic_year: input.academicYear,
      created_by: profile.id,
    }))
  );

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/grades");
  revalidatePath("/dashboard/admin/grades");
  return { created: toCreate.map((a) => `${a.title} (${a.max_score})`) };
}

export async function createCustomAssessment(input: {
  subjectId: string;
  classId: string;
  term: number;
  academicYear: string;
  assessmentType: AssessmentType;
  title: string;
  maxScore: number;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can create assessments.");
  }
  if (!input.title.trim()) {
    throw new Error("Enter a title for this assessment.");
  }

  const supabase = createClient();
  await assertTeacherAssignedTo(supabase, profile.id, input.subjectId, input.classId);

  const { error } = await supabase.from("assessments").insert({
    subject_id: input.subjectId,
    class_id: input.classId,
    title: input.title,
    assessment_type: input.assessmentType,
    max_score: input.maxScore,
    term: input.term,
    academic_year: input.academicYear,
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/grades");
  revalidatePath("/dashboard/admin/grades");
}

// ---------- Note authoring ----------

export async function saveTopicNote(
  topicId: string,
  content: string,
  status: "draft" | "published"
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher") {
    throw new Error("Only teachers can author notes.");
  }

  const supabase = createClient();

  const { data: latest } = await supabase
    .from("topic_notes")
    .select("version")
    .eq("topic_id", topicId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Notes are append-only: publishing a revision never overwrites an
  // earlier draft or published copy, so teachers can review the full
  // topic history later and students continue seeing the latest publish.
  const { error } = await supabase.from("topic_notes").insert({
    topic_id: topicId,
    author_id: profile.id,
    content,
    status,
    version: (latest?.version ?? 0) + 1,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/teacher/notes/${topicId}`);
}

const TOPIC_RESOURCE_BUCKET = "topic-resources";
const MAX_TOPIC_RESOURCE_BYTES = 20 * 1024 * 1024;
const RESOURCE_TYPES = new Map<string, Extract<ResourceType, "image" | "pdf" | "audio" | "video">>([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["application/pdf", "pdf"],
  ["audio/mpeg", "audio"],
  ["audio/wav", "audio"],
  ["audio/ogg", "audio"],
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);

export async function uploadTopicResource(topicId: string, noteId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "teacher")
    throw new Error("Only teachers can upload resources.");

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File) || !file.size) throw new Error("Choose a file to upload.");
  if (file.size > MAX_TOPIC_RESOURCE_BYTES) throw new Error("Resources must be 20 MB or smaller.");
  const resourceType = RESOURCE_TYPES.get(file.type);
  if (!resourceType)
    throw new Error("Use an image, PDF, MP3/WAV/OGG audio, or MP4/WebM video file.");

  const supabase = createClient();
  const [{ data: topic }, { data: teacher }] = await Promise.all([
    supabase.from("curriculum_topics").select("subject_id").eq("id", topicId).single(),
    supabase.from("teacher_profiles").select("subjects_taught").eq("id", profile.id).single(),
  ]);
  if (!topic || !teacher?.subjects_taught?.includes(topic.subject_id)) {
    throw new Error("You can only add resources for subjects assigned to you.");
  }

  const admin = createAdminClient();
  const { error: bucketError } = await admin.storage.createBucket(TOPIC_RESOURCE_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_TOPIC_RESOURCE_BYTES}`,
    allowedMimeTypes: [...RESOURCE_TYPES.keys()],
  });
  if (bucketError && !/already exists/i.test(bucketError.message))
    throw new Error(bucketError.message);

  const extension =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "file";
  const objectPath = `${topicId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(TOPIC_RESOURCE_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: latestResource } = await admin
    .from("topic_resources")
    .select("sequence_order")
    .eq("topic_id", topicId)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: insertError } = await admin.from("topic_resources").insert({
    topic_id: topicId,
    note_id: noteId,
    resource_type: resourceType,
    title: title || file.name,
    file_url: objectPath,
    sequence_order: (latestResource?.sequence_order ?? 0) + 1,
    uploaded_by: profile.id,
  });
  if (insertError) {
    await admin.storage.from(TOPIC_RESOURCE_BUCKET).remove([objectPath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/dashboard/teacher/notes/${topicId}`);
  revalidatePath(`/dashboard/student/topics/${topicId}`);
}
