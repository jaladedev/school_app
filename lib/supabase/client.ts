import { createBrowserClient } from "@supabase/ssr";

// NOTE: not passing a <Database> generic here. Our hand-written types/database.ts
// is a close approximation of the real schema but doesn't perfectly satisfy
// supabase-js's structural constraints for generated types, which causes rows
// to collapse to `never` in a few spots. Once the project is linked to a real
// Supabase instance, run:
//   npx supabase gen types typescript --linked > src/types/database.ts
// and reintroduce createBrowserClient<Database>(...) for full type safety.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
