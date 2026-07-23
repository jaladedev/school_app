"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STORAGE_KEY = "school-app-term-year-selector";

type StoredTermYear = {
  term: number;
  year: string;
};

export function TermYearSelector({
  currentTerm,
  currentYear,
}: {
  currentTerm: number;
  currentYear: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<StoredTermYear>;
      const term = Number(parsed.term);
      const year = parsed.year?.trim();

      if (!Number.isFinite(term) || !year) return;

      const params = new URLSearchParams(searchParams.toString());
      const hasTerm = params.get("term");
      const hasYear = params.get("year");

      if (!hasTerm) params.set("term", String(term));
      if (!hasYear) params.set("year", year);

      const nextTerm = Number(params.get("term") ?? currentTerm);
      const nextYear = params.get("year") ?? currentYear;

      if (nextTerm !== currentTerm || nextYear !== currentYear) {
        router.replace(`${pathname}?${params.toString()}`);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentTerm, currentYear, pathname, router, searchParams]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        term: currentTerm,
        year: currentYear,
      })
    );
  }, [currentTerm, currentYear]);

  function update(term: number, year: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("term", String(term));
    params.set("year", year);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex gap-2 print:hidden">
      <select
        value={currentTerm}
        onChange={(e) => update(Number(e.target.value), currentYear)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
      >
        <option value={1}>Term 1</option>
        <option value={2}>Term 2</option>
        <option value={3}>Term 3</option>
      </select>
      <input
        value={currentYear}
        onChange={(e) => update(currentTerm, e.target.value)}
        className="w-28 rounded-lg border border-rule px-3 py-2 text-sm"
        placeholder="2026/2027"
      />
    </div>
  );
}
