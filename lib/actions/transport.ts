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

/**
 * Admin, the transport officer, or the driver of the specific route being
 * acted on — scoped to per-trip actions (status updates, GPS pings) that
 * a driver legitimately performs from their own phone. A driver isn't a
 * teacher_profiles row at all (role: "driver" on profiles is its own
 * top-level role), so they can never satisfy assertCanManageTransport's
 * admin/teacher check; this mirrors the DB's own is_driver_of_route()
 * RLS check instead of relying on it silently, since the admin client
 * bypasses RLS. Used by both updateTripStatus and
 * recordTransportLocation — anything else driver-facing on a per-trip
 * basis should go through this too, not assertCanManageTransport.
 */
async function assertCanActOnTrip(routeId: string): Promise<{ actorId: string }> {
  const { id, role } = await assertRole(
    ["admin", "teacher", "driver"],
    "Only an admin, the transport officer, or this route's driver can do this."
  );
  const admin = createAdminClient();

  if (role === "admin") return { actorId: id };

  if (role === "driver") {
    const { data: route } = await admin
      .from("transport_routes")
      .select("vehicle_id, vehicles(driver_profile_id)")
      .eq("id", routeId)
      .single();
    if (route?.vehicles?.driver_profile_id !== id) {
      throw new Error("You can only do this for your own route.");
    }
    return { actorId: id };
  }

  // role === "teacher": must be the transport officer.
  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (teacherProfile?.staff_role !== "transport_officer") {
    throw new Error("Only an admin, the transport officer, or this route's driver can do this.");
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

export async function updateStop(input: { stopId: string; name: string; approxTime?: string }) {
  await assertCanManageTransport();
  if (!input.name.trim()) throw new Error("Stop name is required.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("transport_stops")
    .update({ name: input.name.trim(), approx_time: input.approxTime || null })
    .eq("id", input.stopId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
}

/**
 * Swaps sequence_order with the adjacent stop rather than a full
 * drag-and-drop reorder — a route's stop list is short enough (a handful
 * of pickup points) that up/down arrows cover the actual need without
 * the extra client-side complexity a drag interface would add.
 */
export async function moveStop(stopId: string, direction: "up" | "down") {
  await assertCanManageTransport();
  const admin = createAdminClient();

  const { data: stop } = await admin
    .from("transport_stops")
    .select("route_id, sequence_order")
    .eq("id", stopId)
    .single();
  if (!stop) throw new Error("Stop not found.");

  const { data: neighbor } = await admin
    .from("transport_stops")
    .select("id, sequence_order")
    .eq("route_id", stop.route_id)
    .eq("sequence_order", direction === "up" ? stop.sequence_order - 1 : stop.sequence_order + 1)
    .maybeSingle();
  if (!neighbor) return; // already at the top/bottom — nothing to do

  // Two updates, not one transaction — swapping sequence_order under a
  // unique(route_id, sequence_order) constraint needs a temporary
  // out-of-range value in between, or the second update collides with
  // whichever row hasn't moved yet.
  const TEMP_ORDER = -1;
  await admin.from("transport_stops").update({ sequence_order: TEMP_ORDER }).eq("id", stopId);
  await admin
    .from("transport_stops")
    .update({ sequence_order: stop.sequence_order })
    .eq("id", neighbor.id);
  const { error } = await admin
    .from("transport_stops")
    .update({ sequence_order: neighbor.sequence_order })
    .eq("id", stopId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
}

export async function reassignRouteVehicle(routeId: string, vehicleId: string | null) {
  const { id: actorId } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or the transport officer can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", actorId).single();
  if (profile?.role !== "admin") {
    const { data: teacherProfile } = await admin
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", actorId)
      .single();
    if (teacherProfile?.staff_role !== "transport_officer") {
      throw new Error("Only an admin or the transport officer can do this.");
    }
  }

  // Close out the current history row for this route, if any.
  const { error: closeError } = await admin
    .from("route_vehicle_history")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("route_id", routeId)
    .is("unassigned_at", null);
  if (closeError) throw new Error(closeError.message);

  if (vehicleId) {
    const { error: insertError } = await admin.from("route_vehicle_history").insert({
      route_id: routeId,
      vehicle_id: vehicleId,
      assigned_by: actorId,
    });
    if (insertError) throw new Error(insertError.message);
  }

  const { error: updateError } = await admin
    .from("transport_routes")
    .update({ vehicle_id: vehicleId })
    .eq("id", routeId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/admin/transport");
  revalidatePath("/dashboard/transport");
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

  const { data: route } = await admin
    .from("transport_routes")
    .select("vehicle_id, vehicles(capacity)")
    .eq("id", input.routeId)
    .single();

  // Only enforced once a vehicle is actually assigned to the route — a
  // route with no vehicle yet has no known capacity to check against,
  // so assignment isn't blocked on that basis (just on the route
  // existing at all).
  if (route?.vehicle_id && route.vehicles?.capacity != null) {
    const { count: currentRiders } = await admin
      .from("transport_assignments")
      .select("id", { count: "exact", head: true })
      .eq("route_id", input.routeId)
      .is("unassigned_at", null);
    if ((currentRiders ?? 0) >= route.vehicles.capacity) {
      throw new Error("This route's vehicle is already at seating capacity.");
    }
  }

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

// ---------- Admin, transport officer, or the route's own driver: live status ----------

export async function updateTripStatus(input: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  status: TripStatusValue;
}) {
  const { actorId } = await assertCanActOnTrip(input.routeId);
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

/**
 * Records one GPS position update from the driver/transport officer's
 * phone during a trip. Deliberately a plain insert (append history)
 * rather than an upsert on "current position" — the read side only
 * ever wants the latest row anyway, and keeping history costs nothing
 * now while leaving room for a route-path view later without another
 * migration.
 */
export async function recordTransportLocation(input: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  lat: number;
  lng: number;
}) {
  const { actorId } = await assertCanActOnTrip(input.routeId);
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    throw new Error("Invalid coordinates.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("transport_locations").insert({
    route_id: input.routeId,
    trip_date: input.tripDate,
    direction: input.direction,
    lat: input.lat,
    lng: input.lng,
    recorded_by: actorId,
  });
  if (error) throw new Error(error.message);
}
