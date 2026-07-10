"use client";

import { useState, useTransition } from "react";
import { createStudentAccount } from "@/lib/actions/admin";

export function CreateStudentForm({
  classes,
}: {
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [admissionNo, setAdmissionNo] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    startTransition(async () => {
      try {
        await createStudentAccount({
          fullName,
          email,
          temporaryPassword,
          classId,
          admissionNo: admissionNo || undefined,
          guardianName: guardianName || undefined,
          guardianPhone: guardianPhone || undefined,
        });
        setCreated(email);
        setFullName("");
        setEmail("");
        setTemporaryPassword("");
        setAdmissionNo("");
        setGuardianName("");
        setGuardianPhone("");
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
        + Add student
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
        placeholder="Temporary password (share with parent/student directly)"
        value={temporaryPassword}
        onChange={(e) => setTemporaryPassword(e.target.value)}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.arm}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Admission no. (optional)"
          value={admissionNo}
          onChange={(e) => setAdmissionNo(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Guardian name (optional)"
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
        <input
          placeholder="Guardian phone (optional)"
          value={guardianPhone}
          onChange={(e) => setGuardianPhone(e.target.value)}
          className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !classes.length}
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

      {!classes.length && (
        <p className="text-sm text-ink-soft">Create a class first before adding students.</p>
      )}
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