"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createParentAccount, type ParentChildLink } from "@/lib/actions/admin";

type StudentResult = { id: string; full_name: string; class_name: string | null };

export function CreateParentForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [linkedChildren, setLinkedChildren] = useState<
    (ParentChildLink & { fullName: string })[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }

    const { data } = await supabase
      .from("student_profiles")
      .select("id, profiles(full_name), classes(name, arm)")
      .ilike("profiles.full_name", `%${value}%`)
      .limit(8);

    setResults(
      (data ?? [])
        .filter((s) => s.profiles?.full_name)
        .map((s) => ({
          id: s.id,
          full_name: s.profiles!.full_name,
          class_name: s.classes ? `${s.classes.name} ${s.classes.arm ?? ""}`.trim() : null,
        }))
    );
  }

  function addChild(student: StudentResult) {
    if (linkedChildren.some((c) => c.studentId === student.id)) return;
    setLinkedChildren((prev) => [
      ...prev,
      { studentId: student.id, fullName: student.full_name, relationship: "", isPrimary: prev.length === 0 },
    ]);
    setQuery("");
    setResults([]);
  }

  function removeChild(studentId: string) {
    setLinkedChildren((prev) => prev.filter((c) => c.studentId !== studentId));
  }

  function updateRelationship(studentId: string, relationship: string) {
    setLinkedChildren((prev) =>
      prev.map((c) => (c.studentId === studentId ? { ...c, relationship } : c))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await createParentAccount({
          fullName,
          email,
          temporaryPassword,
          children: linkedChildren.map(({ studentId, relationship, isPrimary }) => ({
            studentId,
            relationship,
            isPrimary,
          })),
        });
        setCreated(email);
        setFullName("");
        setEmail("");
        setTemporaryPassword("");
        setLinkedChildren([]);
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
        + Add parent
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl border border-rule bg-white p-4">
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
        placeholder="Temporary password"
        value={temporaryPassword}
        onChange={(e) => setTemporaryPassword(e.target.value)}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
          Link children
        </p>
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search student by name…"
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        {results.length > 0 && (
          <div className="mt-1 rounded-lg border border-rule bg-white">
            {results.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => addChild(s)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span>{s.full_name}</span>
                <span className="text-xs text-ink-soft">{s.class_name}</span>
              </button>
            ))}
          </div>
        )}

        {linkedChildren.length > 0 && (
          <div className="mt-2 space-y-2">
            {linkedChildren.map((c) => (
              <div
                key={c.studentId}
                className="flex items-center gap-2 rounded-lg bg-paper p-2 text-sm"
              >
                <span className="flex-1 text-ink">{c.fullName}</span>
                <input
                  value={c.relationship}
                  onChange={(e) => updateRelationship(c.studentId, e.target.value)}
                  placeholder="Relationship (e.g. Mother)"
                  className="w-40 rounded-md border border-rule px-2 py-1 text-xs"
                />
                {c.isPrimary && (
                  <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs text-leaf">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeChild(c.studentId)}
                  className="text-xs text-clay hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !linkedChildren.length}
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

      {!linkedChildren.length && (
        <p className="text-sm text-ink-soft">Link at least one child before submitting.</p>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
      {created && (
        <p className="text-sm text-leaf">
          Account created for {created}. Share the temporary password directly — it won't be
          shown again.
        </p>
      )}
    </form>
  );
}