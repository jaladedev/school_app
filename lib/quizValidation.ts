/**
 * Validation for a quiz's question list, shared by creating a quiz and
 * editing its questions so both enforce exactly the same rules. Pure (no
 * server imports) so it's unit-testable.
 */
export type QuizQuestionInput = {
  questionText: string;
  questionType: "mcq" | "true_false" | "fill_blank" | "matching" | "essay";
  points: number;
  // mcq/true_false: the option list, one marked correct.
  // fill_blank: each option is one accepted answer (all is_correct: true).
  // matching: each option is a pair -- text is the right side, matchPrompt
  //   the left side; is_correct is unused (every row is "correct" by
  //   construction -- matching is scored on the pairing, not per-option).
  // essay: options is empty; not used at all.
  options: { text: string; isCorrect: boolean; matchPrompt?: string }[];
};

/** Throws an Error with a user-facing message at the first problem found. */
export function validateQuizQuestions(questions: QuizQuestionInput[]): void {
  if (!questions.length) throw new Error("Add at least one question.");

  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    if (!q.questionText.trim()) throw new Error(`Question ${n} needs text.`);
    if (!Number.isFinite(q.points) || q.points <= 0) {
      throw new Error(`Question ${n} needs points greater than zero.`);
    }

    if (q.questionType === "mcq" || q.questionType === "true_false") {
      if (q.options.length < 2) throw new Error(`Question ${n} needs at least two options.`);
      if (q.options.some((o) => !o.text.trim())) {
        throw new Error(`Question ${n} has an empty option.`);
      }
      if (!q.options.some((o) => o.isCorrect)) {
        throw new Error(`Question ${n} needs a correct option marked.`);
      }
    } else if (q.questionType === "fill_blank") {
      if (!q.options.length || q.options.every((o) => !o.text.trim())) {
        throw new Error(`Question ${n} needs at least one accepted answer.`);
      }
    } else if (q.questionType === "matching") {
      if (q.options.length < 2) throw new Error(`Question ${n} needs at least two pairs.`);
      if (q.options.some((o) => !o.matchPrompt?.trim() || !o.text.trim())) {
        throw new Error(`Question ${n} has an incomplete pair.`);
      }
    }
    // essay: question text (and points) are the only requirements.
  }
}

/** The JSON shape create_quiz_with_questions / replace_quiz_questions expect. */
export function questionsToRpcPayload(questions: QuizQuestionInput[]) {
  return questions.map((q) => ({
    question_text: q.questionText.trim(),
    question_type: q.questionType,
    points: q.points,
    options: q.options
      .filter((o) => o.text.trim())
      .map((o) => ({
        text: o.text.trim(),
        match_prompt: o.matchPrompt?.trim() || null,
        // fill_blank has no "wrong" options -- every accepted answer is correct
        is_correct: q.questionType === "fill_blank" ? true : o.isCorrect,
      })),
  }));
}
