"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttempt, QuizAttemptQuestionRow } from "@/types/database";
import { throwDbError } from "@/lib/errors/db";

// These call the RPCs as the student's own authenticated session (not
// the admin client) — the RPCs are SECURITY DEFINER and do their own
// auth.uid()-based checks internally, so there's no separate assertRole
// layer needed here the way the teacher-facing actions in quiz.ts have.

export async function startQuizAttempt(quizId: string): Promise<QuizAttempt> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  if (error) throwDbError(error);
  return data as QuizAttempt;
}

export async function getQuizAttemptQuestions(
  attemptId: string
): Promise<QuizAttemptQuestionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_quiz_attempt_questions", {
    p_attempt_id: attemptId,
  });
  if (error) throwDbError(error);
  return (data ?? []) as QuizAttemptQuestionRow[];
}

export async function answerQuizQuestion(
  attemptId: string,
  questionId: string,
  payload:
    { selectedOptionId: string } | { answerText: string } | { matchedPairs: Record<string, string> }
) {
  const supabase = createClient();
  const { error } = await supabase.rpc("answer_quiz_question", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_option_id: "selectedOptionId" in payload ? payload.selectedOptionId : null,
    p_answer_text: "answerText" in payload ? payload.answerText : null,
    p_matched_pairs: "matchedPairs" in payload ? payload.matchedPairs : null,
  });
  if (error) throwDbError(error);
}

export async function submitQuizAttempt(
  attemptId: string
): Promise<{ score: number; total_points: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });
  if (error) throwDbError(error);

  revalidatePath("/dashboard/student/quizzes");
  return (data as { score: number; total_points: number }[])[0];
}
