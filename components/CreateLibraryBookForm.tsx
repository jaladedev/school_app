"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLibraryBook } from "@/lib/actions/library";

export function CreateLibraryBookForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [copies, setCopies] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const totalCopies = parseInt(copies, 10);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!Number.isFinite(totalCopies) || totalCopies < 1) {
      setError("Copies must be at least 1.");
      return;
    }

    startTransition(async () => {
      try {
        await createLibraryBook({
          title,
          author: author || undefined,
          isbn: isbn || undefined,
          category: category || undefined,
          totalCopies,
        });
        setTitle("");
        setAuthor("");
        setIsbn("");
        setCategory("");
        setCopies("1");
        setOpen(false);
        router.refresh();
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
        Add book
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-xl border border-rule bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author (optional)"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="ISBN (optional)"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional)"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          type="number"
          min={1}
          value={copies}
          onChange={(e) => setCopies(e.target.value)}
          placeholder="Total copies"
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      {error && <p className="text-xs text-clay">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Add to catalog"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-4 py-2 text-sm text-ink-soft hover:bg-paper"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
