"use client";

import { useMemo, useState } from "react";
import { formatLevel, type EducationLevel } from "@/types/database";

export type PickableSubject = {
  id: string;
  name: string;
  education_level: EducationLevel;
  min_level_number: number;
  max_level_number: number;
};

const STAGE_ORDER: EducationLevel[] = ["primary", "jss", "sss"];
const STAGE_LABELS: Record<EducationLevel, string> = {
  primary: "Primary",
  jss: "Junior Secondary",
  sss: "Senior Secondary",
};

function levelRangeLabel(subject: PickableSubject): string {
  const from = formatLevel(subject.education_level, subject.min_level_number);
  if (subject.min_level_number === subject.max_level_number) return from;
  const to = formatLevel(subject.education_level, subject.max_level_number);
  return `${from} – ${to}`;
}

export function SubjectPicker({
  subjects,
  selectedIds,
  onToggle,
}: {
  subjects: PickableSubject[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [subjects, query]);

  const byStage = useMemo(() => {
    const groups = new Map<EducationLevel, PickableSubject[]>();
    for (const s of filtered) {
      groups.set(s.education_level, [...(groups.get(s.education_level) ?? []), s]);
    }
    return groups;
  }, [filtered]);

  if (!subjects.length) {
    return <p className="text-sm text-ink-soft">No subjects created yet.</p>;
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search subjects…"
        className="mb-3 w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      <div className="max-h-64 space-y-3 overflow-y-auto">
        {STAGE_ORDER.filter((stage) => byStage.has(stage)).map((stage) => (
          <div key={stage}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
              {STAGE_LABELS[stage]}
            </p>
            <div className="flex flex-wrap gap-2">
              {byStage.get(stage)!.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  onClick={() => onToggle(subject.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selectedIds.includes(subject.id)
                      ? "border-leaf bg-leaf-soft text-leaf"
                      : "border-rule text-ink-soft hover:bg-paper"
                  }`}
                >
                  {subject.name}{" "}
                  <span className="text-xs opacity-70">({levelRangeLabel(subject)})</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {!filtered.length && (
          <p className="text-sm text-ink-soft">No subjects match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
}
