import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { serverEnv } from "@/lib/env.server";
import { ipv4Fetch } from "@/lib/supabase/ipv4-fetch";

export function createClient() {
  const cookieStorePromise = cookies();

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: ipv4Fetch },
      cookies: {
        async getAll() {
          const cookieStore = await cookieStorePromise;
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookieStorePromise;
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware is refreshing sessions.
          }
        },
      },
    }
  );
}

// Shared by every server-side call site that needs the current user (this
// file's getCurrentProfile, plus assertRole/clearMustChangePassword in
// lib/actions/authGuards.ts and the ownership check in lib/actions/fees.ts).
// Extracted so all of them get the same retry-on-transient-network-blip
// behavior -- a raw, unguarded `await supabase.auth.getUser()` treats a
// network hiccup exactly the same as "not signed in" (both come back as
// `user: null`), which surfaced as a real bug: `assertRole` was throwing
// "You must be signed in." for a legitimately signed-in teacher purely
// because of an intermittent local network fetch failure, right in the
// middle of the exact same network flakiness this retry already handles
// gracefully everywhere else it's used.
export async function getUserWithRetry(supabase: SupabaseClient<Database>) {
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let error: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
    if (!error || !isAuthRetryableFetchError(error)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return { user, error, isTransient: error ? isAuthRetryableFetchError(error) : false };
}

// Fetch the current user's profile (role, name) — used across dashboard pages.
export async function getCurrentProfile() {
  const supabase = createClient();

  // A cold connection (first outbound request after the dev server starts,
  // or after any idle period) is the single most common cause of a
  // transient getUser() failure in practice -- getUserWithRetry's retry
  // exists specifically for that case: one short-lived retry, so a one-off
  // blip resolves silently instead of surfacing the retry-screen error
  // every single time. If it fails twice in a row, that's no longer "the
  // connection was cold," so it's let through to the error path below.
  const { user, error: getUserError, isTransient } = await getUserWithRetry(supabase);

  // A null user here has two very different causes: genuinely not signed
  // in, or the request to Supabase's Auth server itself failed (network
  // blip). Every dashboard layout treats a null return from this function
  // as "not logged in" and redirects to /login -- which is correct for the
  // first case but actively wrong for the second: it silently signs out a
  // legitimately logged-in person because of a transient network hiccup.
  // Throwing here instead lets that case surface as a normal error (caught
  // by Next's nearest error.tsx, which has a built-in retry), rather than
  // masquerading as a logout.
  if (getUserError && isTransient) {
    // The thrown Error's [cause] only ever showed
    // `AuthRetryableFetchError: fetch failed` -- that's supabase-js's own
    // wrapper, not the actual network error underneath it. Logging the
    // full cause chain here (server-side, so it lands in the terminal,
    // not the browser) surfaces what undici/fetch actually failed with
    // (ECONNRESET, a TLS error, a timeout, etc.) instead of the opaque
    // one-line message the error screen shows.
    console.error(
      "[getCurrentProfile] Supabase auth fetch failed. Full cause chain:",
      getUserError,
      "\nunderlying cause:",
      (getUserError as { cause?: unknown }).cause,
      "\ndeeper cause:",
      ((getUserError as { cause?: { cause?: unknown } }).cause as { cause?: unknown } | undefined)
        ?.cause
    );
    throw new Error("Couldn't verify your session right now — check your connection and retry.", {
      cause: getUserError,
    });
  }

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile || !profile.is_active) {
    // Deactivated (or profile missing entirely) — clear the session so a
    // stale-but-valid cookie doesn't keep silently granting access on
    // every subsequent request until it naturally expires.
    await supabase.auth.signOut();
    return null;
  }

  return profile;
}
