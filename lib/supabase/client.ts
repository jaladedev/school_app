import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env.client";
import type { Database } from "@/types/database";

export function createClient() {
  const env = getClientEnv();
  return createBrowserClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
