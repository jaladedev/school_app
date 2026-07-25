"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";

/**
 * Admin or the house parent assigned to the given room/hostel. Mirrors
 * assertCanManageLibrary()'s admin-or-role-check shape, but the role
 * check here is scoped to a specific room's hostel rather than being
 * global — a house parent should only touch their own house.
 */
async function assertCanManageRoom(roomId: string): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or that hostel's house parent can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: room } = await admin
    .from("hostel_rooms")
    .select("hostel_id, hostels(house_parent_id)")
    .eq("id", roomId)
    .single();
  if (room?.hostels?.house_parent_id !== id) {
    throw new Error("Only an admin or that hostel's house parent can do this.");
  }
  return { actorId: id };
}

async function assertCanManageStudentLeave(studentId: string): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or that student's house parent can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: hostelId } = await admin.rpc("student_current_hostel", { sid: studentId });
  if (!hostelId) throw new Error("This student isn't currently assigned to a hostel.");

  const { data: hostel } = await admin
    .from("hostels")
    .select("house_parent_id")
    .eq("id", hostelId)
    .single();
  if (hostel?.house_parent_id !== id) {
    throw new Error("Only an admin or that student's house parent can do this.");
  }
  return { actorId: id };
}

// ---------- Admin: hostel / room setup ----------

export async function createHostel(input: {
  name: string;
  gender: "male" | "female";
  houseParentId?: string;
  capacity?: number;
}) {
  const { id: actorId } = await assertRole(["admin"], "Only an admin can create hostels.");
  if (!input.name.trim()) throw new Error("Name is required.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hostels")
    .insert({
      name: input.name.trim(),
      gender: input.gender,
      house_parent_id: input.houseParentId || null,
      capacity: input.capacity ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "hostel",
    entityId: data.id,
    action: "hostel_created",
    actorId,
    metadata: { name: input.name, gender: input.gender },
  });

  revalidatePath("/dashboard/admin/hostels");
}

export async function createHostelRoom(input: {
  hostelId: string;
  roomNumber: string;
  capacity: number;
}) {
  const { id: actorId } = await assertRole(["admin"], "Only an admin can create rooms.");
  if (!input.roomNumber.trim()) throw new Error("Room number is required.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new Error("Capacity must be a whole number of at least 1.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hostel_rooms")
    .insert({
      hostel_id: input.hostelId,
      room_number: input.roomNumber.trim(),
      capacity: input.capacity,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "hostel_room",
    entityId: data.id,
    action: "hostel_room_created",
    actorId,
    metadata: { hostel_id: input.hostelId, room_number: input.roomNumber },
  });

  revalidatePath("/dashboard/admin/hostels");
}

// ---------- Admin or house parent: assignments ----------

export async function assignStudentToRoom(input: {
  studentId: string;
  roomId: string;
  academicYear: string;
}) {
  const { actorId } = await assertCanManageRoom(input.roomId);
  const admin = createAdminClient();

  const { data: room } = await admin
    .from("hostel_rooms")
    .select("capacity")
    .eq("id", input.roomId)
    .single();
  if (!room) throw new Error("Room not found.");

  const { count: occupied } = await admin
    .from("hostel_assignments")
    .select("id", { count: "exact", head: true })
    .eq("room_id", input.roomId)
    .is("unassigned_at", null);
  if ((occupied ?? 0) >= room.capacity) {
    throw new Error("This room is already at capacity.");
  }

  // Close out any existing active assignment first — a student can only
  // have one active row (enforced by the partial unique index too, this
  // just gives a clearer error path and keeps history correct).
  const { error: closeError } = await admin
    .from("hostel_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("student_id", input.studentId)
    .is("unassigned_at", null);
  if (closeError) throw new Error(closeError.message);

  const { error: insertError } = await admin.from("hostel_assignments").insert({
    student_id: input.studentId,
    room_id: input.roomId,
    academic_year: input.academicYear,
    assigned_by: actorId,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/dashboard/admin/hostels");
}

export async function unassignStudentFromRoom(assignmentId: string, roomId: string) {
  await assertCanManageRoom(roomId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("hostel_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .is("unassigned_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/hostels");
}

// ---------- Admin or house parent: leave logs ----------

export async function logHostelLeave(input: {
  studentId: string;
  reason?: string;
  expectedReturnAt?: string;
}) {
  const { actorId } = await assertCanManageStudentLeave(input.studentId);
  const admin = createAdminClient();

  const { error } = await admin.from("hostel_leave_logs").insert({
    student_id: input.studentId,
    reason: input.reason?.trim() || null,
    expected_return_at: input.expectedReturnAt || null,
    logged_by: actorId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/hostels");
}

export async function recordHostelReturn(leaveLogId: string, studentId: string) {
  const { actorId } = await assertCanManageStudentLeave(studentId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("hostel_leave_logs")
    .update({ returned_at: new Date().toISOString(), returned_logged_by: actorId })
    .eq("id", leaveLogId)
    .is("returned_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/hostels");
}
