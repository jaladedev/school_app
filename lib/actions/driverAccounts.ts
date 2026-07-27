"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

function generateTempPassword(): string {
  // Not meant to be memorable — must_change_password forces a real
  // password on first login, same as every other account type this app
  // creates. This is just enough entropy to hand to the driver once.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
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
  if (authError) throw new Error(authError.message);
  if (!authUser.user) throw new Error("Account creation failed.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    role: "teacher",
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    must_change_password: true,
    is_active: true,
  });
  if (profileError) {
    // Roll back the auth user so a failed profile insert doesn't leave
    // an orphaned login with no matching profile row.
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
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
    throw new Error(teacherProfileError.message);
  }

  if (input.vehicleId) {
    const { error: vehicleError } = await admin
      .from("vehicles")
      .update({ driver_profile_id: authUser.user.id })
      .eq("id", input.vehicleId);
    if (vehicleError) throw new Error(vehicleError.message);
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
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
}
