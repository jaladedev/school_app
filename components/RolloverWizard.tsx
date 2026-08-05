"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runAcademicYearRollover,
  type RolloverPreview,
  type RolloverClassDecision,
  type RolloverResult,
} from "@/lib/actions/rollover";
import { formatLevel } from "@/types/database";

type DecisionAction = RolloverClassDecision["action"];

const ACTION_LABEL: Record<DecisionAction, string> = {
  promote: "Promote",
  repeat: "Repeat",
  graduate: "Graduate",
  skip: "Skip (leave as-is)",
};

export function RolloverWizard({ preview }: { preview: RolloverPreview }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [nextAcademicYear, setNextAcademicYear] = useState(preview.suggestedNextAcademicYear ?? "");
  const [nextTermStartDate, setNextTermStartDate] = useState("");
  const [archiveSourceClasses, setArchiveSourceClasses] = useState(true);

  const [actionByClass, setActionByClass] = useState<Record<string, DecisionAction>>(() => {
    const initial: Record<string, DecisionAction> = {};
    for (const cls of preview.classes) {
      initial[cls.id] = cls.nextLevel ? "promote" : "graduate";
    }
    return initial;
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RolloverResult | null>(null);

  const totalStudents = useMemo(
    () => preview.classes.reduce((sum, c) => sum + c.studentCount, 0),
    [preview.classes]
  );

  function goToReview() {
    setError(null);
    if (!nextAcademicYear.trim()) {
      setError("Enter the next academic year.");
      return;
    }
    if (nextAcademicYear.trim() === preview.currentAcademicYear) {
      setError("That's the current academic year -- enter the new one.");
      return;
    }
    setStep(2);
  }

  function handleRun() {
    setError(null);
    const decisions: RolloverClassDecision[] = preview.classes.map((cls) => {
      const action = actionByClass[cls.id];
      return {
        sourceClassId: cls.id,
        action,
        targetClassId:
          action === "promote" && cls.existingTargetClassId ? cls.existingTargetClassId : null,
      };
    });

    startTransition(async () => {
      try {
        const res = await runAcademicYearRollover({
          nextAcademicYear: nextAcademicYear.trim(),
          nextTermStartDate: nextTermStartDate || null,
          decisions,
          archiveSourceClasses,
        });
        setResult(res);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (result) {
    return (
      <div className="max-w-2xl rounded-xl border border-rule bg-white p-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Rollover complete</h2>
        <ul className="mb-4 space-y-1 text-sm text-ink">
          <li>Classes created: {result.classesCreated}</li>
          <li>Students promoted: {result.studentsPromoted}</li>
          <li>Students repeated: {result.studentsRepeated}</li>
          <li>Students graduated: {result.studentsGraduated}</li>
          <li>Classes archived: {result.classesArchived}</li>
        </ul>
        {!!result.errors.length && (
          <div className="mb-4 rounded-lg bg-clay/10 p-3 text-xs text-clay">
            <p className="mb-1 font-medium">Some items need attention:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <a
          href="/dashboard/admin/classes"
          className="inline-block rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90"
        >
          Go to Classes
        </a>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-rule bg-white p-6">
        <div>
          <p className="text-xs text-ink-soft">
            Current: {preview.currentAcademicYear || "—"} · Term {preview.currentTerm}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Next academic year</label>
          <input
            value={nextAcademicYear}
            onChange={(e) => setNextAcademicYear(e.target.value)}
            placeholder="2026/2027"
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-leaf"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Term 1 start date (optional)
          </label>
          <input
            type="date"
            value={nextTermStartDate}
            onChange={(e) => setNextTermStartDate(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-leaf"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Used to compute the current scheme-of-work week for students/parents.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={archiveSourceClasses}
            onChange={(e) => setArchiveSourceClasses(e.target.checked)}
          />
          Archive this year&apos;s classes once their students have moved on
        </label>

        <p className="text-xs text-ink-soft">
          {preview.classes.length} active classes · {totalStudents} students total.
        </p>

        {error && <p className="text-sm text-clay">{error}</p>}

        <button
          onClick={goToReview}
          className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90"
        >
          Review plan →
        </button>
      </div>
    );
  }

  // Step 2: per-class review/edit, then confirm.
  return (
    <div>
      <div className="mb-4 rounded-lg bg-marigold/10 px-4 py-3 text-sm text-marigold-text">
        Moving to <strong>{nextAcademicYear}</strong>, Term 1
        {nextTermStartDate ? ` starting ${nextTermStartDate}` : ""}. Review each class below, then
        confirm.
      </div>

      <div className="mb-4 space-y-2">
        {preview.classes.map((cls) => {
          const action = actionByClass[cls.id];
          return (
            <div
              key={cls.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {formatLevel(cls.educationLevel, cls.levelNumber)}
                  {cls.arm ? ` ${cls.arm}` : ""}{" "}
                  <span className="text-xs text-ink-soft">({cls.studentCount} students)</span>
                </p>
                <p className="text-xs text-ink-soft">
                  {action === "graduate"
                    ? "No further level -- these students graduate."
                    : action === "repeat"
                      ? `Repeats at ${formatLevel(cls.educationLevel, cls.levelNumber)}${cls.arm ? ` ${cls.arm}` : ""} for ${nextAcademicYear}`
                      : action === "promote" && cls.nextLevel
                        ? `→ ${formatLevel(cls.nextLevel.educationLevel, cls.nextLevel.levelNumber)}${cls.arm ? ` ${cls.arm}` : ""}${cls.existingTargetClassId ? " (existing class)" : " (new class)"}`
                        : "Students stay where they are -- handle manually later."}
                </p>
              </div>

              <select
                value={action}
                onChange={(e) =>
                  setActionByClass((prev) => ({
                    ...prev,
                    [cls.id]: e.target.value as DecisionAction,
                  }))
                }
                className="rounded-lg border border-rule px-3 py-1.5 text-sm outline-none focus-visible:border-leaf"
              >
                {cls.nextLevel && <option value="promote">{ACTION_LABEL.promote}</option>}
                <option value="repeat">{ACTION_LABEL.repeat}</option>
                <option value="graduate">{ACTION_LABEL.graduate}</option>
                <option value="skip">{ACTION_LABEL.skip}</option>
              </select>
            </div>
          );
        })}
      </div>

      {error && <p className="mb-3 text-sm text-clay">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          disabled={isPending}
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
        >
          ← Back
        </button>
        <button
          onClick={handleRun}
          disabled={isPending}
          className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Running rollover…" : "Confirm and run rollover"}
        </button>
      </div>
    </div>
  );
}
