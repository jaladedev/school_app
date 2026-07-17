"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EducationLevel } from "@/types/database";

import { createClassSchema, fieldErrorsFrom } from "@/lib/validation";

const LEVEL_OPTIONS: Record<EducationLevel, { label: string; numbers: number[] }> = {
  primary: { label: "Primary", numbers: [1, 2, 3, 4, 5, 6] },
  jss: { label: "JSS", numbers: [1, 2, 3] },
  sss: { label: "SS", numbers: [1, 2, 3] },
};

// Nigerian academic years typically run September–July. Default to the
// current session so admins usually don't need to touch this field.
function defaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function CreateClassForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("primary");
  const [levelNumber, setLevelNumber] = useState(1);
  const [arm, setArm] = useState("");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const stageLabel = LEVEL_OPTIONS[educationLevel].label;
  const derivedName = `${stageLabel} ${levelNumber}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input = { educationLevel, levelNumber, arm: arm || undefined, academicYear };
    const errors = fieldErrorsFrom(createClassSchema, input);
    if (errors) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const { error: insertError } = await supabase.from("classes").insert({
        name: derivedName,
        arm: arm || null,
        education_level: educationLevel,
        level_number: levelNumber,
        academic_year: academicYear,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setArm("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New class
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Stage</p>
        <div className="flex gap-2">
          {(Object.keys(LEVEL_OPTIONS) as EducationLevel[]).map((level) => (
            <button
              type="button"
              key={level}
              onClick={() => {
                setEducationLevel(level);
                setLevelNumber(1);
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                educationLevel === level
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft"
              }`}
            >
              {LEVEL_OPTIONS[level].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            {stageLabel} level
          </p>
          <select
            value={levelNumber}
            onChange={(e) => setLevelNumber(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {LEVEL_OPTIONS[educationLevel].numbers.map((n) => (
              <option key={n} value={n}>
                {stageLabel} {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Arm (optional)
          </p>
          <input
            placeholder="A, B, Gold…"
            value={arm}
            onChange={(e) => setArm(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Academic year
          </p>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          />
          {fieldErrors.academicYear && (
            <p className="mt-1 text-xs text-clay">{fieldErrors.academicYear}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        Will be created as <strong>{derivedName}</strong>
        {arm ? ` ${arm}` : ""}.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create class"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
