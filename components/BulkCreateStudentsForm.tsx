"use client";

import { useRef, useState, useTransition } from "react";
import { createStudentsBulk, type BulkStudentResult } from "@/lib/actions/admin";

type PasswordStrategy = "auto" | "shared";

function parseRows(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullName, email, admissionNo, guardianName, guardianPhone] = line
        .split(",")
        .map((part) => part.trim());
      return { fullName, email, admissionNo, guardianName, guardianPhone };
    });
}

export function BulkCreateStudentsForm({
  classes,
}: {
  classes: { id: string; name: string; arm: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [strategy, setStrategy] = useState<PasswordStrategy>("auto");
  const [sharedPassword, setSharedPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkStudentResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = parseRows(raw);
  const invalidRows = parsed.filter((r) => !r.fullName || !r.email);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // A CSV export/file may have a header row ("Full Name,Email,...")
      // — drop it if the first line doesn't look like a real email entry.
      const lines = text.split("\n");
      const looksLikeHeader = lines[0] && !lines[0].includes("@");
      setRaw(looksLikeHeader ? lines.slice(1).join("\n") : text);
    };
    reader.readAsText(file);

    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);

    if (!parsed.length) {
      setError("Paste at least one student row, or upload a CSV file.");
      return;
    }
    if (invalidRows.length) {
      setError("Every row needs at least a full name and an email, separated by commas.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createStudentsBulk({
          classId,
          students: parsed,
          passwordStrategy: strategy,
          sharedPassword: strategy === "shared" ? sharedPassword : undefined,
        });
        setResults(res);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-leaf px-4 py-2 text-sm font-medium text-leaf hover:bg-leaf-soft"
      >
        + Add multiple students
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-rule bg-white p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              One student per line: Full Name, Email, Admission No (optional), Guardian
              Name (optional), Guardian Phone (optional)
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-lg border border-rule px-2 py-1 text-xs font-medium text-ink hover:bg-paper"
            >
              Upload CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={
              "Amina Yusuf, amina.yusuf@school.edu.ng, P4-014, Mrs Yusuf, 08012345678\n" +
              "Tunde Bakare, tunde.bakare@school.edu.ng, P4-015"
            }
            className="w-full rounded-lg border border-rule px-3 py-2 font-mono text-sm outline-none focus-visible:border-marigold"
          />
          {parsed.length > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              {parsed.length} row{parsed.length === 1 ? "" : "s"} detected
              {invalidRows.length > 0 && (
                <span className="text-clay"> — {invalidRows.length} missing name/email</span>
              )}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Password
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStrategy("auto")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                strategy === "auto"
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft"
              }`}
            >
              Auto-generate one per student
            </button>
            <button
              type="button"
              onClick={() => setStrategy("shared")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                strategy === "shared"
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft"
              }`}
            >
              Use one shared password
            </button>
          </div>
          {strategy === "shared" && (
            <input
              type="text"
              minLength={8}
              placeholder="Shared temporary password (min 8 characters)"
              value={sharedPassword}
              onChange={(e) => setSharedPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !classes.length}
            className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {isPending ? `Creating ${parsed.length || ""} accounts…` : "Create all"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft"
          >
            Close
          </button>
        </div>

        {error && <p className="text-sm text-clay">{error}</p>}
      </form>

      {results && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="mb-2 text-sm font-medium text-ink">
            {results.filter((r) => r.success).length} of {results.length} created
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper text-left text-xs uppercase text-ink-soft">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Password</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.email} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2 text-ink">{r.fullName}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.email}</td>
                    <td className="px-3 py-2">
                      {r.success ? (
                        <span className="font-mono text-leaf">{r.password}</span>
                      ) : (
                        <span className="text-clay">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Copy these passwords out now — they won't be shown again after you leave this page.
          </p>
        </div>
      )}
    </div>
  );
}