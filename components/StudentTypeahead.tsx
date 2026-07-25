"use client";

import { useMemo, useRef, useState } from "react";

export type StudentOption = { id: string; label: string };

/**
 * Dependency-free search/typeahead. No new package was added for this —
 * consistent with the BarList approach elsewhere in the app — just a
 * text input filtering a plain list, with basic keyboard navigation.
 */
export function StudentTypeahead({
  students,
  value,
  onChange,
  placeholder = "Search student by name or admission no…",
}: {
  students: StudentOption[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = students.find((s) => s.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 20);
  }, [students, query]);

  function selectStudent(student: StudentOption) {
    onChange(student.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const student = filtered[highlighted];
      if (student) selectStudent(student);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex w-full items-center justify-between rounded-lg border border-rule bg-white px-3 py-2 text-left text-sm"
        >
          <span className="truncate">{selected.label}</span>
          <span className="ml-2 shrink-0 text-xs text-ink-soft">Change</span>
        </button>
      ) : (
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a dropdown option registers first.
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
        />
      )}

      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-rule bg-white shadow-md">
          {filtered.length ? (
            filtered.map((student, i) => (
              <button
                key={student.id}
                type="button"
                onMouseDown={() => selectStudent(student)}
                className={`block w-full truncate px-3 py-2 text-left text-sm ${
                  i === highlighted ? "bg-leaf-soft text-leaf" : "text-ink hover:bg-paper"
                }`}
              >
                {student.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-ink-soft">No matching students.</p>
          )}
        </div>
      )}
    </div>
  );
}
