"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchTopicNotes } from "@/lib/actions/search";
import type { TopicNoteSearchResult } from "@/types/database";

// ts_headline's snippet is delimited with chr(1)/chr(2) markers rather
// than HTML tags (see the search_topic_notes migration) -- split on them
// here and render <mark> as real React elements, so a note body that
// happens to contain "<" or "&" can never be interpreted as markup.
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\x01[^\x02]*\x02)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("\x01") ? (
          <mark key={i} className="bg-marigold/40 text-ink">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function NoteSearch({ resultBasePath }: { resultBasePath: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TopicNoteSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      searchTopicNotes(trimmed)
        .then((rows) => {
          setResults(rows);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes by keyword…"
        className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
      />

      {loading && <p className="mt-3 text-sm text-ink-soft">Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <p className="mt-3 text-sm text-ink-soft">No notes matched &quot;{query.trim()}&quot;.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((r) => (
            <Link
              key={r.note_id}
              href={`${resultBasePath}/${r.topic_id}`}
              className="block rounded-lg border border-rule bg-white p-3 hover:border-leaf"
            >
              <p className="text-sm font-medium text-ink">{r.topic_title ?? "Untitled topic"}</p>
              {r.subject_name && <p className="mb-1 text-xs text-ink-soft">{r.subject_name}</p>}
              <p className="text-sm text-ink-soft">
                <Snippet text={r.snippet} />
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}