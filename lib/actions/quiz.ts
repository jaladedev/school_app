"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

type QuestionInput = {
  questionText: string;
  questionType: "mcq" | "true_false";
  points: number;
  options: { text: string; isCorrect: boolean }[];
};

export async function createQuiz(input: {
  title: string;
  subjectId: string;
  classId: string;
  term: number;
  academicYear: string;
  durationMinutes: number;
  opensAt?: string;
  closesAt?: string;
  questions: QuestionInput[];
}) {
  const { id: actorId, role: actorRole } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or a teacher can create a quiz."
  );

  // Teachers may only create quizzes for subjects they're assigned to.
  // RLS (assessments_write_teacher_admin) only checks created_by, not
  // subjects_taught, so this has to be enforced here.
  if (actorRole === "teacher") {
    const admin = createAdminClient();
    const { data: teacherProfile, error: teacherError } = await admin
      .from("teacher_profiles")
      .select("subjects_taught")
      .eq("id", actorId)
      .single();
    if (teacherError) throw new Error(teacherError.message);

    const assignedSubjects = teacherProfile?.subjects_taught ?? [];
    if (!assignedSubjects.includes(input.subjectId)) {
      throw new Error("You can only create quizzes for subjects you teach.");
    }
  }

  if (!input.title.trim()) throw new Error("Title is required.");
  if (!input.questions.length) throw new Error("Add at least one question.");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
    throw new Error("Duration must be a whole number of minutes.");
  }
  for (const [i, q] of input.questions.entries()) {
    if (!q.questionText.trim()) throw new Error(`Question ${i + 1} needs text.`);
    if (q.options.length < 2) throw new Error(`Question ${i + 1} needs at least two options.`);
    if (!q.options.some((o) => o.isCorrect)) {
      throw new Error(`Question ${i + 1} needs a correct option marked.`);
    }
  }

  const admin = createAdminClient();
  const totalPoints = input.questions.reduce((sum, q) => sum + q.points, 0);

  // Underlying assessment first — max_score is set to the sum of question
  // points and is never edited independently afterward, so it can't drift
  // out of sync with what submit_quiz_attempt() computes (the DB trigger
  // check_grade_score_bounds relies on this staying true).
  const { data: assessment, error: assessmentError } = await admin
    .from("assessments")
    .insert({
      subject_id: input.subjectId,
      class_id: input.classId,
      title: input.title.trim(),
      max_score: totalPoints,
      term: input.term,
      academic_year: input.academicYear,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (assessmentError) throw new Error(assessmentError.message);

  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .insert({
      assessment_id: assessment.id,
      duration_minutes: input.durationMinutes,
      opens_at: input.opensAt || null,
      closes_at: input.closesAt || null,
    })
    .select("id")
    .single();
  if (quizError) {
    // Best-effort cleanup — the assessment row is orphaned without a
    // quiz otherwise. Not wrapped in a real transaction since these are
    // two sequential client calls, not a single RPC; a failure here is
    // rare (the insert above already validated shape) but worth
    // reverting rather than leaving a dangling assessment.
    await admin.from("assessments").delete().eq("id", assessment.id);
    throw new Error(quizError.message);
  }

  for (const [qIndex, q] of input.questions.entries()) {
    const { data: question, error: questionError } = await admin
      .from("quiz_questions")
      .insert({
        quiz_id: quiz.id,
        question_text: q.questionText.trim(),
        question_type: q.questionType,
        points: q.points,
        sequence_order: qIndex + 1,
      })
      .select("id")
      .single();
    if (questionError) throw new Error(questionError.message);

    const { error: optionsError } = await admin.from("quiz_options").insert(
      q.options.map((o, oIndex) => ({
        question_id: question.id,
        option_text: o.text.trim(),
        is_correct: o.isCorrect,
        sequence_order: oIndex + 1,
      }))
    );
    if (optionsError) throw new Error(optionsError.message);
  }

  revalidatePath("/dashboard/teacher/quizzes");
  return quiz.id as string;
}

export async function setQuizPublished(quizId: string, isPublished: boolean) {
  await assertRole(["admin", "teacher"], "Only an admin or teacher can do this.");
  const admin = createAdminClient();

  const { error } = await admin
    .from("quizzes")
    .update({ is_published: isPublished })
    .eq("id", quizId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/quizzes");
  revalidatePath(`/dashboard/teacher/quizzes/${quizId}`);
}
