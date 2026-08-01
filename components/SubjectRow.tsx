"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EducationLevel, Subject } from "@/types/database";

const STAGE_MAX: Record<EducationLevel, number> = { primary: 6, jss: 3, sss: 3 };
const STAGE_LABEL: Record<EducationLevel, string> = { primary: "Primary", jss: "JSS", sss: "SS" };

export function SubjectRow({ subject }: { subject: Subject }) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code ?? "");
  const [minLevel, setMinLevel] = useState(subject.min_level_number);
  const [maxLevel, setMaxLevel] = useState(subject.max_level_number);
  const [description, setDescription] = useState(subject.description ?? "");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // education_level itself isn't editable here -- curriculum topics already
  // reference it, and changing it out from under existing topics would be a
  // bigger, riskier operation than this row is meant to handle.
  const stageMax = STAGE_MAX[subject.education_level];
  const levelNumbers = Array.from({ length: stageMax }, (_, i) => i + 1);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Subject name can't be empty.");
      return;
    }
    // This is the exact condition that used to leave the "level" dropdown on
    // the curriculum page silently blank downstream -- caught here instead,
    // before it can be saved.
    if (minLevel > maxLevel) {
      setError("Minimum level can't be greater than maximum level.");
      return;
    }

    startTransition(async () => {
      const { error: updateError } = await supabase
        .from("subjects")
        .update({
          name: name.trim(),
          code: code.trim() || null,
          min_level_number: minLevel,
          max_level_number: maxLevel,
          description: description.trim() || null,
        })
        .eq("id", subject.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-2 rounded-lg border border-rule bg-paper p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="Subject name"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
            placeholder="Code (optional)"
          />
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(Number(e.target.value))}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {levelNumbers.map((n) => (
              <option key={n} value={n}>
                From: {STAGE_LABEL[subject.education_level]} {n}
              </option>
            ))}
          </select>
          <select
            value={maxLevel}
            onChange={(e) => setMaxLevel(Number(e.target.value))}
            className="rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {levelNumbers.map((n) => (
              <option key={n} value={n}>
                To: {STAGE_LABEL[subject.education_level]} {n}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          placeholder="Description (optional)"
        />

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-sm text-clay">{error}</p>}
      </form>
    );
  }

  const rangeIsInvalid = subject.min_level_number > subject.max_level_number;

  return (
    <div className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3">
      <div>
        <p className="text-ink">{subject.name}</p>
        {subject.description && <p className="text-xs text-ink-soft">{subject.description}</p>}
        {rangeIsInvalid && (
          <p className="mt-1 text-xs text-clay">
            Level range is invalid (min above max) — the level picker on the curriculum page is
            blank for this subject until it&apos;s fixed here.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-ink-soft">
          {STAGE_LABEL[subject.education_level]} {subject.min_level_number}–
          {subject.max_level_number}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft hover:bg-paper"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
