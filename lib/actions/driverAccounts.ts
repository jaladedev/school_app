"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { throwDbError } from "@/lib/errors/db";

function generateTempPassword(): string {
  // Not meant to be memorable — must_change_password forces a real
  // password on first login, same as every other account type this app
  // creates. Uses getRandomValues directly rather than slicing a
  // randomUUID() string: a v4 UUID has two non-random nibbles baked in
  // (the version nibble fixed to '4' and the variant nibble constrained
  // to one of 8/9/a/b), which land at fixed positions in the
  // dash-stripped string -- a naive .slice(0, N) can end up including
  // one or both depending on N, quietly losing a few bits of the
  // entropy the length suggests. 8 raw random bytes -> 16 hex chars is
  // unambiguously 64 bits, no fixed positions to reason about.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a new driver login and, optionally, links it to a vehicle in
 * the same step. Mirrors whatever your existing teacher/parent account
 * creation action does for the actual auth.admin.createUser + profiles
 * insert shape — double-check that against this if your app already has
 * a shared "createAccount" helper, since this was written standalone
 * without seeing that file.
 */
export async function createDriverAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  vehicleId?: string;
}): Promise<{ tempPassword: string }> {
  await assertRole(["admin"], "Only an admin can create driver accounts.");
  if (!input.fullName.trim()) throw new Error("Name is required.");
  if (!input.email.trim()) throw new Error("Email is required.");

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: tempPassword,
    email_confirm: true,
  });
  if (authError) throwDbError(authError);
  if (!authUser.user) throw new Error("Account creation failed.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    // "driver" is a teacher_profiles.staff_role value, not a profiles.role
    // value (profiles.role is only "student" | "teacher" | "admin" |
    // "parent" — see UserRole in types/database.ts). Every other staff
    // role (bursar, librarian, transport_officer, house_parent) follows
    // the same pattern: role: "teacher" here, plus a teacher_profiles row
    // with staff_role set. assertCanUpdateTrip() in transport.ts already
    // depends on that shape (assertRole(["admin","teacher"]) first, then
    // teacher_profiles.staff_role === "driver"), so without the
    // teacher_profiles row below a driver created here couldn't actually
    // do anything a driver needs to do.
    role: "teacher",
    full_name: input.fullName.trim(),
    must_change_password: true,
    is_active: true,
  });
  if (profileError) {
    // Roll back the auth user so a failed profile insert doesn't leave
    // an orphaned login with no matching profile row.
    await admin.auth.admin.deleteUser(authUser.user.id);
    throwDbError(profileError);
  }

  // email/phone live in profile_contacts now, not profiles — see
  // profile_contacts_migration.sql.
  const { error: contactError } = await admin.from("profile_contacts").insert({
    id: authUser.user.id,
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
  });
  if (contactError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throwDbError(contactError);
  }

  const { error: teacherProfileError } = await admin.from("teacher_profiles").insert({
    id: authUser.user.id,
    staff_role: "driver",
  });
  if (teacherProfileError) {
    // Same rollback reasoning as above — don't leave a profiles row with
    // no matching teacher_profiles row, since every staff_role check in
    // this app (is_bursar, is_librarian, assertCanUpdateTrip, etc.)
    // requires both rows to exist together.
    await admin.auth.admin.deleteUser(authUser.user.id);
    throwDbError(teacherProfileError);
  }

  if (input.vehicleId) {
    const { error: vehicleError } = await admin
      .from("vehicles")
      .update({ driver_profile_id: authUser.user.id })
      .eq("id", input.vehicleId);
    if (vehicleError) throwDbError(vehicleError);
  }

  revalidatePath("/dashboard/admin/transport");
  return { tempPassword };
}

export async function linkDriverToVehicle(vehicleId: string, driverProfileId: string | null) {
  await assertRole(["admin"], "Only an admin can link a driver to a vehicle.");
  const admin = createAdminClient();

  const { error } = await admin
    .from("vehicles")
    .update({ driver_profile_id: driverProfileId })
    .eq("id", vehicleId);
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/transport");
}
