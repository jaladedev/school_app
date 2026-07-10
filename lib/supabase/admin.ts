import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// SERVER-ONLY. Never import this from a Client Component ("use client")
// file — the service role key bypasses RLS entirely and must never reach
// the browser bundle. It has no NEXT_PUBLIC_ prefix specifically so that
// Next.js never inlines it into client code.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}