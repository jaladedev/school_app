"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLibraryBookCopies, archiveLibraryBook } from "@/lib/actions/library";
import type { LibraryBook } from "@/types/database";

export function LibraryBookRow({ book }: { book: LibraryBook }) {
  const router = useRouter();
  const [editingCopies, setEditingCopies] = useState(false);
  const [copies, setCopies] = useState(String(book.total_copies));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveCopies() {
    setError(null);
    const totalCopies = parseInt(copies, 10);
    if (!Number.isFinite(totalCopies) || totalCopies < 0) {
      setError("Enter a valid number.");
      return;
    }
    startTransition(async () => {
      try {
        await updateLibraryBookCopies(book.id, totalCopies);
        setEditingCopies(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  function toggleArchive() {
    startTransition(async () => {
      try {
        await archiveLibraryBook(book.id, !book.is_archived);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div
      className={`rounded-lg border border-rule bg-white px-4 py-3 ${book.is_archived ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-ink">
            {book.title}
            {book.is_archived && (
              <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
                Archived
              </span>
            )}
          </p>
          <p className="text-xs text-ink-soft">
            {[book.author, book.category, book.isbn].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {editingCopies ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
                className="w-16 rounded-md border border-rule px-2 py-1 text-sm"
              />
              <button
                onClick={saveCopies}
                disabled={isPending}
                className="rounded-md bg-marigold px-2 py-1 text-xs font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingCopies(false);
                  setCopies(String(book.total_copies));
                }}
                className="rounded-md border border-rule px-2 py-1 text-xs text-ink-soft hover:bg-paper"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingCopies(true)}
              className="text-xs text-ink-soft hover:underline"
            >
              {book.available_copies} / {book.total_copies} available
            </button>
          )}

          <button
            onClick={toggleArchive}
            disabled={isPending}
            className="text-xs font-medium text-clay hover:underline disabled:opacity-60"
          >
            {book.is_archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}
