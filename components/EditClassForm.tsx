"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditClassForm({
  classId,
  currentName,
  currentArm,
  currentAcademicYear,
  isArchived,
  onClose,
}: {
  classId: string;
  currentName: string;
  currentArm: string | null;
  currentAcademicYear: string;
  isArchived: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(currentName);
  const [arm, setArm] = useState(currentArm ?? "");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: updateError } = await supabase
        .from("classes")
        .update({ name, arm: arm || null, academic_year: academicYear })
        .eq("id", classId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  function handleToggleArchive() {
    setError(null);
    startTransition(async () => {
      const { error: archiveError } = await supabase
        .from("classes")
        .update({ is_archived: !isArchived })
        .eq("id", classId);

      if (archiveError) {
        setError(archiveError.message);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-2 space-y-2 rounded-lg border border-rule bg-paper p-3"
    >
      <div className="grid grid-cols-3 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          placeholder="Class name"
        />
        <input
          value={arm}
          onChange={(e) => setArm(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          placeholder="Arm"
        />
        <input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
          placeholder="Academic year"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleToggleArchive}
          disabled={isPending}
          className="rounded-lg border border-clay px-3 py-1.5 text-sm font-medium text-clay hover:bg-clay/10 disabled:opacity-60"
        >
          {isArchived ? "Unarchive" : "Archive"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}