"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";

type QuestionInput = {
  questionText: string;
  questionType: "mcq" | "true_false" | "fill_blank" | "matching" | "essay";
  points: number;
  // mcq/true_false: the option list, one marked correct.
  // fill_blank: each option is one accepted answer (all is_correct: true).
  // matching: each option is a pair — text is the right side, matchPrompt
  //   the left side; is_correct is unused (every row is "correct" by
  //   construction — matching is scored on the pairing, not per-option).
  // essay: options is empty; not used at all.
  options: { text: string; isCorrect: boolean; matchPrompt?: string }[];
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
    if (q.questionType === "mcq" || q.questionType === "true_false") {
      if (q.options.length < 2) throw new Error(`Question ${i + 1} needs at least two options.`);
      if (!q.options.some((o) => o.isCorrect)) {
        throw new Error(`Question ${i + 1} needs a correct option marked.`);
      }
    } else if (q.questionType === "fill_blank") {
      if (!q.options.length || q.options.every((o) => !o.text.trim())) {
        throw new Error(`Question ${i + 1} needs at least one accepted answer.`);
      }
    } else if (q.questionType === "matching") {
      if (q.options.length < 2) throw new Error(`Question ${i + 1} needs at least two pairs.`);
      if (q.options.some((o) => !o.matchPrompt?.trim() || !o.text.trim())) {
        throw new Error(`Question ${i + 1} has an incomplete pair.`);
      }
    }
    // essay: question text is the only requirement, already checked above.
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

    const nonBlankOptions = q.options.filter((o) => o.text.trim());
    if (nonBlankOptions.length) {
      const { error: optionsError } = await admin.from("quiz_options").insert(
        nonBlankOptions.map((o, oIndex) => ({
          question_id: question.id,
          option_text: o.text.trim(),
          match_prompt: o.matchPrompt?.trim() || null,
          // fill_blank has no "wrong" options — every accepted answer is correct
          is_correct: q.questionType === "fill_blank" ? true : o.isCorrect,
          sequence_order: oIndex + 1,
        }))
      );
      if (optionsError) throw new Error(optionsError.message);
    }
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

// Awards points for one or more essay answers on an already-submitted
// attempt and recomputes that attempt's total score. `scores` maps
// question id -> points awarded; a teacher can grade essays one at a
// time across visits, each call only touches the questions it's given.
export async function gradeQuizEssayAnswers(
  quizId: string,
  attemptId: string,
  scores: Record<string, number>
) {
  await assertRole(["admin", "teacher"], "Only an admin or teacher can do this.");

  // Runs as the caller's own session (not the admin client) — the RPC is
  // SECURITY DEFINER and checks auth.uid() against is_admin()/
  // subjects_taught internally, same pattern the student-facing RPCs in
  // quizAttempt.ts already use.
  const supabase = createClient();
  const { error } = await supabase.rpc("grade_quiz_essay_answers", {
    p_attempt_id: attemptId,
    p_scores: scores,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/teacher/quizzes/${quizId}`);
}
