"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateClassForm() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [arm, setArm] = useState("");
  const [gradeLevel, setGradeLevel] = useState(1);
  const [academicYear, setAcademicYear] = useState("2026/2027");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("classes").insert({
      name,
      arm: arm || null,
      grade_level: gradeLevel,
      academic_year: academicYear,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName("");
    setArm("");
    setOpen(false);
    router.refresh();
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
      className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-rule bg-white p-4 sm:grid-cols-5"
    >
      <input
        required
        placeholder="Name (e.g. Primary 4)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="col-span-2 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold sm:col-span-1"
      />
      <input
        placeholder="Arm (e.g. A)"
        value={arm}
        onChange={(e) => setArm(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <input
        required
        type="number"
        min={1}
        max={12}
        placeholder="Grade level"
        value={gradeLevel}
        onChange={(e) => setGradeLevel(Number(e.target.value))}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <input
        required
        placeholder="Academic year"
        value={academicYear}
        onChange={(e) => setAcademicYear(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>
      {error && <p className="col-span-full text-sm text-clay">{error}</p>}
    </form>
  );
}
