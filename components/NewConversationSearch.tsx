"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewConversationSearch({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .neq("id", currentUserId)
        .ilike("full_name", `%${value}%`)
        .limit(10);
      setResults(data ?? []);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
      >
        + New message
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-rule bg-white p-4">
      <input
        autoFocus
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by name…"
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      {isPending && <p className="mt-2 text-xs text-ink-soft">Searching…</p>}

      <div className="mt-2 space-y-1">
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => router.push(`/dashboard/messages/${r.id}`)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-paper"
          >
            <span className="text-ink">{r.full_name}</span>
            <span className="text-xs capitalize text-ink-soft">{r.role}</span>
          </button>
        ))}
        {query && !results.length && !isPending && (
          <p className="px-3 py-2 text-sm text-ink-soft">No matches.</p>
        )}
      </div>

      <button onClick={() => setOpen(false)} className="mt-2 text-sm text-ink-soft hover:underline">
        Cancel
      </button>
    </div>
  );
}
