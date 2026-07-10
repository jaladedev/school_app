"use client";

import { useState, useTransition } from "react";
import { createTeacherAccount } from "@/lib/actions/admin";

export function CreateTeacherForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  function toggleSubject(id: string) {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    startTransition(async () => {
      try {
        await createTeacherAccount({ fullName, email, temporaryPassword, subjectIds });
        setCreated(email);
        setFullName("");
        setEmail("");
        setTemporaryPassword("");
        setSubjectIds([]);
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
        + Add teacher
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
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <input
        required
        type="text"
        minLength={8}
        placeholder="Temporary password (share with the teacher directly)"
        value={temporaryPassword}
        onChange={(e) => setTemporaryPassword(e.target.value)}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
          Subjects taught
        </p>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => toggleSubject(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                subjectIds.includes(s.id)
                  ? "bg-leaf text-white"
                  : "bg-paper text-ink-soft hover:bg-leaf-soft"
              }`}
            >
              {s.name}
            </button>
          ))}
          {!subjects.length && (
            <p className="text-xs text-ink-soft">No subjects created yet.</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create account"}
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
      {created && (
        <p className="text-sm text-leaf">
          Account created for {created}. Share the temporary password with them directly —
          it won't be shown again here.
        </p>
      )}
    </form>
  );
}