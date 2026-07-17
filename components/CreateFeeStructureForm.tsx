"use client";

import { useState, useTransition } from "react";
import { createFeeStructure } from "@/lib/actions/fees";
import type { EducationLevel } from "@/types/database";

const LEVEL_OPTIONS: Record<EducationLevel, { label: string; numbers: number[] }> = {
  primary: { label: "Primary", numbers: [1, 2, 3, 4, 5, 6] },
  jss: { label: "JSS", numbers: [1, 2, 3] },
  sss: { label: "SS", numbers: [1, 2, 3] },
};

function defaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function CreateFeeStructureForm() {
  const [open, setOpen] = useState(false);
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("primary");
  const [levelNumber, setLevelNumber] = useState(1);
  const [term, setTerm] = useState(1);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [title, setTitle] = useState("Tuition Fee");
  const [amountNaira, setAmountNaira] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const naira = parseFloat(amountNaira);
    if (isNaN(naira) || naira <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    startTransition(async () => {
      try {
        await createFeeStructure({
          educationLevel,
          levelNumber,
          term,
          academicYear,
          title,
          amountKobo: Math.round(naira * 100),
          dueDate: dueDate || undefined,
        });
        setSuccess(true);
        setAmountNaira("");
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New fee structure
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Tuition Fee, PTA Levy"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          type="number"
          step="0.01"
          value={amountNaira}
          onChange={(e) => setAmountNaira(e.target.value)}
          placeholder="Amount (₦)"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

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

      <div className="grid grid-cols-4 gap-3">
        <select
          value={levelNumber}
          onChange={(e) => setLevelNumber(Number(e.target.value))}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          {LEVEL_OPTIONS[educationLevel].numbers.map((n) => (
            <option key={n} value={n}>
              {LEVEL_OPTIONS[educationLevel].label} {n}
            </option>
          ))}
        </select>
        <select
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        >
          <option value={1}>Term 1</option>
          <option value={2}>Term 2</option>
          <option value={3}>Term 3</option>
        </select>
        <input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Close
        </button>
      </div>

      {success && <p className="text-sm text-leaf">Created.</p>}
      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
