"use client";

import { localIsoDate } from "@/lib/quizWindow";

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
}

const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 2 days", days: 2 },
  { label: "Next week", days: 7 },
];

/** Due-date input with quick picks, shared by log-lesson, give-homework and edit-homework. */
export function HomeworkDueDateField({
  id,
  value,
  onChange,
  min,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date (YYYY-MM-DD) -- usually the lesson date. */
  min: string;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "space-y-2 opacity-50" : "space-y-2"}>
      <label htmlFor={id} className="block text-xs font-medium text-ink">
        Due date <span className="font-normal text-ink-soft">(optional)</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-rule bg-white px-3 py-1.5 text-sm outline-none focus-visible:border-marigold"
        />
        {PRESETS.map((preset) => {
          const date = inDays(preset.days);
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(date)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                value === date
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft hover:border-leaf"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-ink-soft hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
