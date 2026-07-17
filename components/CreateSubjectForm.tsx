"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EducationLevel } from "@/types/database";

const LEVEL_OPTIONS: Record<EducationLevel, { label: string; max: number }> = {
  primary: { label: "Primary", max: 6 },
  jss: { label: "JSS", max: 3 },
  sss: { label: "SS", max: 3 },
};

export function CreateSubjectForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("primary");
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(6);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const levelNumbers = Array.from({ length: LEVEL_OPTIONS[educationLevel].max }, (_, i) => i + 1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (minLevel > maxLevel) {
      setError("Minimum level can't be greater than maximum level.");
      return;
    }

    startTransition(async () => {
      const { error: insertError } = await supabase.from("subjects").insert({
        name,
        code: code || null,
        education_level: educationLevel,
        min_level_number: minLevel,
        max_level_number: maxLevel,
        description: description || null,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setName("");
      setCode("");
      setDescription("");
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
        + New subject
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
          required
          placeholder="Subject name (e.g. Mathematics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Code (optional, e.g. MTH-P46)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
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
                setMinLevel(1);
                setMaxLevel(LEVEL_OPTIONS[level].max);
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">From</p>
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {levelNumbers.map((n) => (
              <option key={n} value={n}>
                {LEVEL_OPTIONS[educationLevel].label} {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">To</p>
          <select
            value={maxLevel}
            onChange={(e) => setMaxLevel(Number(e.target.value))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          >
            {levelNumbers.map((n) => (
              <option key={n} value={n}>
                {LEVEL_OPTIONS[educationLevel].label} {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create subject"}
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
