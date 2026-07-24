"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubjectPicker, type PickableSubject } from "@/components/SubjectPicker";
import { updateTeacherSubjects } from "@/lib/actions/admin";

export function EditTeacherSubjectsForm({
  teacherId,
  currentSubjectIds,
  allSubjects,
}: {
  teacherId: string;
  currentSubjectIds: string[];
  allSubjects: PickableSubject[];
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
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

    try {
      await updateTeacherSubjects(teacherId, selectedSubjects);
    } catch (err: any) {
      setSaving(false);
      setError(err.message ?? "Could not save subjects.");
      return;
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-leaf hover:underline"
      >
        Edit subjects
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-rule bg-paper p-4">
      <p className="mb-2 text-sm font-medium text-ink">Subjects taught</p>

      <SubjectPicker
        subjects={allSubjects}
        selectedIds={selectedSubjects}
        onToggle={toggleSubject}
      />

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save subjects"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelectedSubjects(currentSubjectIds);
            setError(null);
          }}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
    </form>
  );
}
