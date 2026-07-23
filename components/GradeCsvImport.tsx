"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importGrades } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function GradeCsvImport({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result).replace(/^\uFEFF/, ""));
        const [header, ...data] = rows;
        const admissionIndex = header?.findIndex((value) => value.toLowerCase() === "admission no");
        const scoreIndex = header?.findIndex((value) => value.toLowerCase() === "score");
        const remarkIndex = header?.findIndex((value) => value.toLowerCase() === "remark");

        if (
          admissionIndex === undefined ||
          admissionIndex < 0 ||
          scoreIndex === undefined ||
          scoreIndex < 0
        ) {
          throw new Error('CSV headings must include "Admission No" and "Score".');
        }

        const entries = data.map((row) => ({
          admissionNo: row[admissionIndex] ?? "",
          score: Number(row[scoreIndex]),
          remark: remarkIndex !== undefined && remarkIndex >= 0 ? row[remarkIndex] : undefined,
        }));

        startTransition(async () => {
          try {
            await importGrades(assessmentId, entries);
            emitToast(`${entries.length} grade${entries.length === 1 ? "" : "s"} imported.`);
            router.refresh();
          } catch (err: any) {
            setError(err.message ?? "Could not import grades.");
          }
        });
      } catch (err: any) {
        setError(err.message ?? "Could not read that CSV file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mb-4 rounded-lg border border-rule bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">Import grades CSV</p>
          <p className="text-xs text-ink-soft">Headings: Admission No, Score, Remark (optional)</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="rounded-lg border border-leaf px-3 py-2 text-sm font-medium text-leaf hover:bg-leaf-soft disabled:opacity-60"
        >
          {isPending ? "Importing…" : "Choose CSV"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}
