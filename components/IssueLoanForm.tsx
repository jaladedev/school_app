"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueLibraryLoan } from "@/lib/actions/library";
import { StudentTypeahead, type StudentOption } from "@/components/StudentTypeahead";

export function IssueLoanForm({
  books,
  students,
}: {
  books: { id: string; title: string; available_copies: number }[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!bookId || !studentId || !dueAt) {
      setError("Choose a book, a student, and a due date.");
      return;
    }

    startTransition(async () => {
      try {
        await issueLibraryLoan({ bookId, studentId, dueAt });
        setBookId("");
        setStudentId("");
        setDueAt("");
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  const availableBooks = books.filter((b) => b.available_copies > 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid gap-3 rounded-xl border border-rule bg-white p-4 sm:grid-cols-4"
    >
      <select
        value={bookId}
        onChange={(e) => setBookId(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
      >
        <option value="">Book…</option>
        {availableBooks.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title} ({b.available_copies} available)
          </option>
        ))}
      </select>

      <StudentTypeahead students={students} value={studentId} onChange={setStudentId} />

      <input
        type="date"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
      />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
      >
        {isPending ? "Issuing…" : "Issue loan"}
      </button>

      {error && <p className="text-xs text-clay sm:col-span-4">{error}</p>}
      {!availableBooks.length && (
        <p className="text-xs text-ink-soft sm:col-span-4">
          No books currently have available copies.
        </p>
      )}
    </form>
  );
}
