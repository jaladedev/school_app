"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

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
