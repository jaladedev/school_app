import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { READ_ONLY_SESSION_MINUTES } from "@/lib/readOnlySession";
import { throwDbError } from "@/lib/errors/db";

// The account a support session signs in as: an ordinary admin account in the
// school's database, flagged read-only. It is created the first time support
// opens the school and reused afterwards, so the school's admins can see it in
// their user list and in the audit log ("Platform support"). Nobody ever logs
// in to it with a password; the password is random and never stored.

export const SUPPORT_VIEWER_EMAIL = "platform-support@support.invalid";
export const SUPPORT_VIEWER_NAME = "Platform support (read-only)";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Makes sure the support account exists, is an active admin, and carries a
 * fresh read-only window ending READ_ONLY_SESSION_MINUTES from `now`. Returns
 * its id and the time the session ends.
 */
export async function prepareSupportViewer(
  admin: Admin,
  by: string,
  now: Date = new Date()
): Promise<{ id: string; until: Date }> {
  const until = new Date(now.getTime() + READ_ONLY_SESSION_MINUTES * 60 * 1000);
  const appMetadata = {
    read_only: true,
    read_only_until: until.toISOString(),
    impersonated_by: by,
  };

  const { data: existing, error: lookupError } = await admin
    .from("profile_contacts")
    .select("id")
    .ilike("email", SUPPORT_VIEWER_EMAIL)
    .maybeSingle();
  if (lookupError) throwDbError(lookupError);

  if (existing) {
    // Keep it usable even if a school admin deactivated or changed it: support
    // access is part of the contract.
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "admin",
        is_active: true,
        must_change_password: false,
        full_name: SUPPORT_VIEWER_NAME,
      })
      .eq("id", existing.id);
    if (profileError) throwDbError(profileError);

    const { error: metaError } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: appMetadata,
    });
    if (metaError) throw new Error(`Could not prepare the support session: ${metaError.message}`);
    return { id: existing.id, until };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: SUPPORT_VIEWER_EMAIL,
    password: randomBytes(32).toString("hex"),
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Could not create the support account.");
  }
  const id = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id,
    role: "admin",
    full_name: SUPPORT_VIEWER_NAME,
    must_change_password: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(id);
    throwDbError(profileError);
  }
  const { error: contactError } = await admin
    .from("profile_contacts")
    .insert({ id, email: SUPPORT_VIEWER_EMAIL });
  if (contactError) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
    throwDbError(contactError);
  }
  return { id, until };
}
