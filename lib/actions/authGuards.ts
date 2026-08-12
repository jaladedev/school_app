"use server";

import type { User } from "@supabase/supabase-js";
import { createClient, getUserWithRetry } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";
import { throwDbError } from "@/lib/errors/db";

/**
 * Resolves the JWT-validated current user, distinguishing a transient
 * network failure from "not signed in" -- both come back as `user: null`
 * from a bare getUser() call, so without this a blip looks identical to
 * a logged-out session. Shared by assertRole (below) and anything with a
 * different authorization shape that still needs the same "who is this,
 * really" check first. verifyPaystackPayment (fees.ts) used to duplicate
 * this exact getUserWithRetry + isTransient + null-check block inline
 * instead of calling a shared helper -- a future change to the retry
 * behavior had two call sites to update instead of one.
 */
export async function getAuthenticatedUser(): Promise<User> {
  const supabase = createClient();
  const { user, error: getUserError, isTransient } = await getUserWithRetry(supabase);

  if (getUserError && isTransient) {
    throw new Error("Couldn't verify your session right now — check your connection and retry.", {
      cause: getUserError,
    });
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user;
}

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
): Promise<{ id: string; role: UserRole }> {
  const user = await getAuthenticatedUser();

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError && !profile && profileError.message.includes("fetch failed")) {
    throw new Error("Couldn't verify your session right now — check your connection and retry.", {
      cause: profileError,
    });
  }

  if (!profile || !profile.is_active || !allowedRoles.includes(profile.role)) {
    throw new Error(errorMessage);
  }

  return { id: user.id, role: profile.role };
}

/** Clears only the current user's first-login password-change flag. */
export async function clearMustChangePassword() {
  const user = await getAuthenticatedUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) throwDbError(error);
}
