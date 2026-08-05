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

  // One RPC call = one Postgres transaction (see
  // 2026_08_05b_create_quiz_with_questions_rpc.sql) -- if question 3 of 5
  // fails to insert, the whole thing rolls back instead of leaving
  // questions 1-2 (and the quiz/assessment rows) orphaned.
  const { data: quizId, error } = await admin.rpc("create_quiz_with_questions", {
    p_subject_id: input.subjectId,
    p_class_id: input.classId,
    p_title: input.title.trim(),
    p_term: input.term,
    p_academic_year: input.academicYear,
    p_created_by: actorId,
    p_duration_minutes: input.durationMinutes,
    p_opens_at: input.opensAt || null,
    p_closes_at: input.closesAt || null,
    p_questions: input.questions.map((q) => ({
      question_text: q.questionText.trim(),
      question_type: q.questionType,
      points: q.points,
      options: q.options
        .filter((o) => o.text.trim())
        .map((o) => ({
          text: o.text.trim(),
          match_prompt: o.matchPrompt?.trim() || null,
          // fill_blank has no "wrong" options — every accepted answer is correct
          is_correct: q.questionType === "fill_blank" ? true : o.isCorrect,
        })),
    })),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/teacher/quizzes");
  return quizId as string;
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
