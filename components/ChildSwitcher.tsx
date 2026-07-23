"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { LinkedChild } from "@/lib/parent";

export function ChildSwitcher({
  linkedChildren,
  selectedChildId,
}: {
  linkedChildren: LinkedChild[];
  selectedChildId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (linkedChildren.length <= 1) {
    return (
      <p className="mb-4 text-sm text-ink-soft">
        Viewing: <span className="font-medium text-ink">{linkedChildren[0]?.fullName}</span>
      </p>
    );
  }

  function handleChange(childId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", childId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
        Viewing
      </label>
      <select
        value={selectedChildId}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-rule px-3 py-2 text-sm"
      >
        {linkedChildren.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
            {c.className ? ` — ${c.className}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
