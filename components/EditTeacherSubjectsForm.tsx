"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditTeacherSubjectsForm({
  teacherId,
  currentSubjectIds,
  allSubjects,
  onClose,
}: {
  teacherId: string;
  currentSubjectIds: string[];
  allSubjects: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(currentSubjectIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Allowed by the existing "teacher_profiles_update_self_or_admin" RLS
    // policy — no service-role client needed for a subject-list update.
    const { error: updateError } = await supabase
      .from("teacher_profiles")
      .update({ subjects_taught: selectedSubjects })
      .eq("id", teacherId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-rule bg-paper p-4"
    >
      <p className="mb-2 text-sm font-medium text-ink">Subjects taught</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {allSubjects.map((subject) => (
          <button
            type="button"
            key={subject.id}
            onClick={() => toggleSubject(subject.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              selectedSubjects.includes(subject.id)
                ? "border-leaf bg-leaf-soft text-leaf"
                : "border-rule text-ink-soft"
            }`}
          >
            {subject.name}
          </button>
        ))}
        {!allSubjects.length && (
          <p className="text-sm text-ink-soft">No subjects created yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save subjects"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
    </form>
  );
}