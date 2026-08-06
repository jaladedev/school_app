"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small trigger button + capped-height scrollable option list. Native
 * <select> popups can't be styled short/scrollable -- height and scroll
 * behavior there are entirely up to the browser -- so this renders the
 * list ourselves (max-h-40, overflow-y-auto) to actually get a short,
 * scrollable dropdown.
 */
function ScrollDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  width = "w-16",
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  ariaLabel: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    // Scroll the current value into view instead of always opening at
    // the top of a 24-entry hour list.
    const selected = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    selected?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${width}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg border border-rule px-2 py-2 text-left text-sm hover:border-marigold"
      >
        {value || "--"}
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-rule bg-white shadow-lg"
        >
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={opt === value}
                data-selected={opt === value}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full px-2 py-1 text-left text-sm hover:bg-paper ${opt === value ? "bg-marigold/20 font-medium text-ink" : "text-ink-soft"}`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/**
 * "HH:mm" time picker: two short, scrollable dropdowns (hour, minute)
 * rather than native <input type="time"> or <select> -- consistent
 * across browsers, and the option list is capped/scrollable instead of
 * whatever height the browser decides. Value/onChange stay in the same
 * "HH:mm" 24h string shape the native input used, so callers didn't
 * need to change.
 */
export function TimeSelect({
  value,
  onChangeAction,
  className = "",
}: {
  value: string;
  onChangeAction: (value: string) => void;
  className?: string;
}) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  return (
    <div className={`flex gap-1 ${className}`}>
      <ScrollDropdown
        ariaLabel="Hour"
        value={hour}
        options={HOURS}
        onChange={(h) => onChangeAction(`${h}:${minute || "00"}`)}
      />
      <ScrollDropdown
        ariaLabel="Minute"
        value={minute}
        options={MINUTES}
        onChange={(m) => onChangeAction(`${hour || "00"}:${m}`)}
      />
    </div>
  );
}
