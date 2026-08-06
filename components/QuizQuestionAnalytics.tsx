import { BarList } from "@/components/BarList";
import { QuestionText } from "@/components/QuestionText";
import type { QuestionAnalytics } from "@/lib/actions/quiz";

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

/**
 * One card per question showing how the class did on it: option pick
 * distribution for mcq/true_false, correct/incorrect split for
 * fill_blank/matching, and grading progress + average award for essay.
 * `totalSubmitted` (not attemptedCount) is the denominator for the
 * headline % so a question nobody skipped reads the same as one several
 * students left blank — skips are called out separately instead of
 * quietly inflating the "correct" rate.
 */
export function QuizQuestionAnalytics({
  totalSubmitted,
  questions,
}: {
  totalSubmitted: number;
  questions: QuestionAnalytics[];
}) {
  if (!totalSubmitted) {
    return (
      <p className="text-sm text-ink-soft">
        No submitted attempts yet — analytics will appear once students start submitting.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.questionId} className="rounded-lg border border-rule bg-white p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Question {i + 1} · {q.questionType.replace("_", " ")}
            </span>
            <span className="text-xs text-ink-soft">{q.points} pts</span>
          </div>
          <QuestionText text={q.questionText} className="mb-3" />

          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span>
              Avg score: <span className="font-medium text-ink">{q.avgPoints.toFixed(1)}</span>/
              {q.points}
            </span>
            {q.correctCount !== undefined && (
              <span>
                <span className="font-medium text-ink">{pct(q.correctCount, totalSubmitted)}%</span>{" "}
                got it right ({q.correctCount}/{totalSubmitted})
              </span>
            )}
            {q.gradedCount !== undefined && (
              <span>
                <span className="font-medium text-ink">{q.gradedCount}</span>/{q.attemptedCount}{" "}
                graded
              </span>
            )}
            {q.skippedCount > 0 && (
              <span className="text-clay">
                {q.skippedCount} skipped ({pct(q.skippedCount, totalSubmitted)}%)
              </span>
            )}
          </div>

          {q.optionBreakdown && (
            <BarList
              items={q.optionBreakdown.map((o) => ({
                label: `${o.isCorrect ? "✓ " : ""}${o.text}`,
                value: o.count,
                displayValue: `${o.count} (${pct(o.count, totalSubmitted)}%)`,
              }))}
              colorClassName="bg-leaf"
            />
          )}

          {q.optionBreakdown === undefined && q.correctCount !== undefined && (
            <BarList
              items={[
                {
                  label: "Correct",
                  value: q.correctCount,
                  displayValue: `${q.correctCount} (${pct(q.correctCount, totalSubmitted)}%)`,
                },
                {
                  label: "Incorrect / incomplete",
                  value: q.attemptedCount - q.correctCount,
                  displayValue: `${q.attemptedCount - q.correctCount}`,
                },
              ]}
              colorClassName="bg-leaf"
            />
          )}
        </div>
      ))}
      {!questions.length && <p className="text-sm text-ink-soft">This quiz has no questions.</p>}
    </div>
  );
}
