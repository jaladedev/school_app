"use client";

import { useRef, useState, useTransition } from "react";
import { createParentsBulk, type BulkParentResult } from "@/lib/actions/admin";
import { parseCsv } from "@/lib/csv";

type PasswordStrategy = "auto" | "shared";

function parseRows(raw: string) {
  return parseCsv(raw).map(([fullName, email, admissionNos, relationship, isPrimary]) => ({
    fullName: (fullName ?? "").trim(),
    email: (email ?? "").trim(),
    // Multiple children for one parent go in a single field, separated
    // by ";" -- comma is already the CSV field separator, so it can't
    // double as the in-field separator here.
    admissionNos: (admissionNos ?? "")
      .split(";")
      .map((a) => a.trim())
      .filter(Boolean),
    relationship: (relationship ?? "").trim(),
    isPrimary: /^(y|yes|1|true)$/i.test((isPrimary ?? "").trim()),
  }));
}

export function BulkCreateParentsForm() {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [strategy, setStrategy] = useState<PasswordStrategy>("auto");
  const [sharedPassword, setSharedPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkParentResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = parseRows(raw);
  const invalidRows = parsed.filter((r) => !r.fullName || !r.email || !r.admissionNos.length);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const looksLikeHeader = lines[0] && !lines[0].includes("@");
      setRaw(looksLikeHeader ? lines.slice(1).join("\n") : text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);

    if (!parsed.length) {
      setError("Paste at least one parent row, or upload a CSV file.");
      return;
    }
    if (invalidRows.length) {
      setError("Every row needs a full name, an email, and at least one student admission number.");
      return;
    }
    if (strategy === "shared" && sharedPassword.length < 8) {
      setError("Shared password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createParentsBulk({
          parents: parsed,
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
        className="rounded-lg border border-marigold px-4 py-2 text-sm font-medium text-marigold-text hover:bg-marigold/10"
      >
        + Add multiple parents
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-rule bg-white p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              One parent per line: Full Name, Email, Admission No(s) (separate multiple with ;),
              Relationship (optional), Primary? y/n (optional)
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
              "Mrs Yusuf, mrs.yusuf@example.com, P4-014, Mother, y\n" +
              "Mr Bakare, mr.bakare@example.com, P4-015;P4-016, Father, y"
            }
            className="w-full rounded-lg border border-rule px-3 py-2 font-mono text-sm outline-none focus-visible:border-marigold"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Each admission number must already belong to an existing student — import students first
            if you haven&apos;t yet.
          </p>
          {parsed.length > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              {parsed.length} row{parsed.length === 1 ? "" : "s"} detected
              {invalidRows.length > 0 && (
                <span className="text-clay">
                  {" "}
                  — {invalidRows.length} missing a name, email, or admission no.
                </span>
              )}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Password</p>
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
              Auto-generate one per parent
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
            disabled={isPending}
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
          <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper text-left text-xs uppercase text-ink-soft">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Children linked</th>
                  <th className="px-3 py-2">Password</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.email} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2 text-ink">{r.fullName}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.email}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.childrenLinked ?? "—"}</td>
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
            Copy these passwords out now — they won&apos;t be shown again after you leave this page.
          </p>
        </div>
      )}
    </div>
  );
}
