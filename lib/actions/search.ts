"use server";

import { createClient } from "@/lib/supabase/server";
import type { TopicNoteSearchResult } from "@/types/database";
import { throwDbError } from "@/lib/errors/db";
import { runAction, type ActionResult } from "@/lib/actionResult";

// Runs as the caller's own session (not the admin client) -- the RPC is
// plain SQL, not security definer, so topic_notes' existing RLS applies
// exactly as it would to a normal SELECT. See the migration comment on
// search_topic_notes for why that matters.
export async function searchTopicNotes(
  query: string
): Promise<ActionResult<TopicNoteSearchResult[]>> {
  return runAction(async () => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_topic_notes", {
      p_query: trimmed,
      p_limit: 20,
    });
    if (error) throwDbError(error);
    return (data ?? []) as TopicNoteSearchResult[];
  });
}
