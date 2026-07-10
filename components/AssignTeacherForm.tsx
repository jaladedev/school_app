"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AssignTeacherForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // The account must already exist in Supabase Auth (created by an admin
    // in the Supabase dashboard, since creating auth users requires the
    // service-role key, not something the browser client can hold safely).
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (lookupError || !profile) {
      setSaving(false);
      setError(
        "No account found with that email. Create the user in Supabase Auth first, then assign them here."
      );
      return;
    }

    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "teacher" })
      .eq("id", profile.id);

    if (roleError) {
      setSaving(false);
      setError(roleError.message);
      return;
    }

    const { error: teacherError } = await supabase.from("teacher_profiles").upsert({
      id: profile.id,
      subjects_taught: selectedSubjects,
    });

    setSaving(false);

    if (teacherError) {
      setError(teacherError.message);
      return;
    }

    setEmail("");
    setSelectedSubjects([]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + Assign teacher
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-rule bg-white p-4"
    >
      <p className="mb-3 text-sm text-ink-soft">
        The account must already exist in Supabase Auth. This assigns the{" "}
        <span className="font-medium text-ink">teacher</span> role and the
        subjects they teach.
      </p>

      <input
        required
        type="email"
        placeholder="teacher@school.edu.ng"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-3 w-full max-w-sm rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <p className="mb-2 text-sm font-medium text-ink">Subjects taught</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {subjects.map((subject) => (
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
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Assign"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
    </form>
  );
}
