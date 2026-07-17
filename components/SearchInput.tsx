"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    setValue(next);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      params.delete("page"); // reset to page 1 on a new search
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <input
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className="w-64 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
    />
  );
}
