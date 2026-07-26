"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import type { TripDirection, TripStatusValue } from "@/types/database";

/** Admin or the transport officer — global, unlike the hostel version,
 * since there's normally just the one transport officer running the
 * whole fleet rather than one per route. */
async function assertCanManageTransport(): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or the transport officer can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (teacherProfile?.staff_role !== "transport_officer") {
    throw new Error("Only an admin or the transport officer can do this.");
  }
  return { actorId: id };
}

// ---------- Admin: fleet setup ----------

export async function createVehicle(input: {
  plateNumber: string;
  model?: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
}) {
  await assertRole(["admin"], "Only an admin can add vehicles.");
  if (!input.plateNumber.trim()) throw new Error("Plate number is required.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new Error("Capacity must be a whole number of at least 1.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("vehicles").insert({
    plate_number: input.plateNumber.trim(),
    model: input.model?.trim() || null,
    capacity: input.capacity,
    driver_name: input.driverName?.trim() || null,
    driver_phone: input.driverPhone?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
}

export async function createRoute(input: {
  name: string;
  description?: string;
  vehicleId?: string;
}) {
  await assertRole(["admin"], "Only an admin can create routes.");
  if (!input.name.trim()) throw new Error("Name is required.");

  const admin = createAdminClient();
  const { error } = await admin.from("transport_routes").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    vehicle_id: input.vehicleId || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
}

export async function createStop(input: {
  routeId: string;
  name: string;
  sequenceOrder: number;
  approxTime?: string;
}) {
  await assertRole(["admin"], "Only an admin can add stops.");
  if (!input.name.trim()) throw new Error("Stop name is required.");

  const admin = createAdminClient();
  const { error } = await admin.from("transport_stops").insert({
    route_id: input.routeId,
    name: input.name.trim(),
    sequence_order: input.sequenceOrder,
    approx_time: input.approxTime || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
}

// ---------- Admin or transport officer: assignments ----------

export async function assignStudentToRoute(input: {
  studentId: string;
  routeId: string;
  stopId: string;
  academicYear: string;
}) {
  const { actorId } = await assertCanManageTransport();
  const admin = createAdminClient();

  const { error: closeError } = await admin
    .from("transport_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("student_id", input.studentId)
    .is("unassigned_at", null);
  if (closeError) throw new Error(closeError.message);

  const { error: insertError } = await admin.from("transport_assignments").insert({
    student_id: input.studentId,
    route_id: input.routeId,
    stop_id: input.stopId,
    academic_year: input.academicYear,
    assigned_by: actorId,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/dashboard/admin/transport");
}

export async function unassignStudentFromRoute(assignmentId: string) {
  await assertCanManageTransport();
  const admin = createAdminClient();

  const { error } = await admin
    .from("transport_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .is("unassigned_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
}

// ---------- Admin or transport officer: live status ----------

export async function updateTripStatus(input: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  status: TripStatusValue;
}) {
  const { actorId } = await assertCanManageTransport();
  const admin = createAdminClient();

  const { error } = await admin.from("transport_trip_status").upsert(
    {
      route_id: input.routeId,
      trip_date: input.tripDate,
      direction: input.direction,
      status: input.status,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "route_id,trip_date,direction" }
  );
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
}
