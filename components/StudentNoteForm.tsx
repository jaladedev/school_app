"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudentNote } from "@/lib/actions/studentNotes";
import type { StudentNoteType } from "@/types/database";

const TYPE_OPTIONS: { value: StudentNoteType; label: string }[] = [
  { value: "academic", label: "Academic" },
  { value: "behavioral", label: "Behavioral" },
  { value: "commendation", label: "Commendation" },
  { value: "disciplinary", label: "Disciplinary" },
];

export function StudentNoteForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [noteType, setNoteType] = useState<StudentNoteType>("academic");
  const [content, setContent] = useState("");
  const [visibleToStudent, setVisibleToStudent] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await createStudentNote({ studentId, noteType, content, visibleToStudent });
        setContent("");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-rule bg-white p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => setNoteType(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              noteType === opt.value
                ? "bg-leaf text-white"
                : "bg-paper text-ink-soft hover:bg-leaf-soft"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <textarea
        required
        placeholder="Write the note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="mb-3 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <label className="mb-3 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={visibleToStudent}
          onChange={(e) => setVisibleToStudent(e.target.checked)}
        />
        Visible to the student
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add note"}
      </button>

      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </form>
  );
}