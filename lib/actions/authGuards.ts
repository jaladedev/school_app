"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * Verifies the current user has one of the allowed roles, throwing
 * errorMessage if not. Deliberately re-checks via the service-role
 * client rather than trusting getCurrentProfile()'s result: auth.getUser()
 * validates the JWT directly against Supabase's Auth server and can't be
 * spoofed, but the profile ROW getCurrentProfile() reads is fetched with
 * the session's anon-key client — its trustworthiness for a
 * security-critical gate like this one depends entirely on RLS SELECT
 * policies on `profiles` being airtight. Reading the row again here with
 * the admin client removes that dependency, and also catches deactivated
 * accounts, which a plain role check doesn't.
 */
export async function assertRole(
  allowedRoles: UserRole[],
  errorMessage: string
): Promise<{ id: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !allowedRoles.includes(profile.role)) {
    throw new Error(errorMessage);
  }

  return { id: user.id };
}