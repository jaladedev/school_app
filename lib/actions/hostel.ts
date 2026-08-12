"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";

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

/**
 * Admin or the house parent of the given hostel directly (as opposed to
 * assertCanManageRoom, which is scoped by room). Used for hostel-level
 * actions — fee structures and the waitlist — that aren't tied to one
 * specific room.
 */
async function assertCanManageHostel(hostelId: string): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or that hostel's house parent can do this."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: hostel } = await admin
    .from("hostels")
    .select("house_parent_id")
    .eq("id", hostelId)
    .single();
  if (hostel?.house_parent_id !== id) {
    throw new Error("Only an admin or that hostel's house parent can do this.");
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
  if (error) throwDbError(error);

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
  if (error) throwDbError(error);

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
  // The room lock, capacity check, gender-match check, close-old-
  // assignment, insert-new-assignment, and waitlist auto-fulfill all
  // happen inside assign_student_to_hostel_room in one transaction —
  // closes the race window the old sequential app-side calls had.
  await assertCanManageRoom(input.roomId);
  const admin = createAdminClient();

  const { error } = await admin.rpc("assign_student_to_hostel_room", {
    p_student_id: input.studentId,
    p_room_id: input.roomId,
    p_academic_year: input.academicYear,
  });
  if (error) throwDbError(error);

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
  if (error) throwDbError(error);

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
  if (error) throwDbError(error);

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
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/hostels");
}

// ---------- Admin or house parent: visitor log ----------
//
// Distinct from logHostelLeave/recordHostelReturn above: those track a
// RESIDENT leaving the hostel and coming back. This tracks an EXTERNAL
// visitor coming in to see a resident student — same actor/permission
// shape (assertCanManageStudentLeave), separate table
// (hostel_visitor_logs) since the two aren't the same event and querying
// "who's currently out" vs "who's currently visiting" separately is
// clearer than overloading one table with a `kind` column.

export async function logHostelVisitorCheckIn(input: {
  studentId: string;
  visitorName: string;
  visitorPhone?: string;
  relationship?: string;
  purpose?: string;
}) {
  const { actorId } = await assertCanManageStudentLeave(input.studentId);
  const admin = createAdminClient();

  if (!input.visitorName.trim()) {
    throw new Error("Visitor name is required.");
  }

  const { error } = await admin.from("hostel_visitor_logs").insert({
    student_id: input.studentId,
    visitor_name: input.visitorName.trim(),
    visitor_phone: input.visitorPhone?.trim() || null,
    relationship: input.relationship?.trim() || null,
    purpose: input.purpose?.trim() || null,
    logged_by: actorId,
  });
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/hostels");
}

export async function recordHostelVisitorCheckOut(visitorLogId: string, studentId: string) {
  const { actorId } = await assertCanManageStudentLeave(studentId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("hostel_visitor_logs")
    .update({ checked_out_at: new Date().toISOString(), checked_out_logged_by: actorId })
    .eq("id", visitorLogId)
    .is("checked_out_at", null);
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/hostels");
}

// ---------- Admin or house parent: capacity waitlist ----------

/**
 * Puts a student on the waitlist for a hostel that's currently full.
 * assignStudentToRoom auto-fulfills the matching entry (by student +
 * hostel) whenever a room in that hostel opens up and the student is
 * assigned to it — no separate "promote from waitlist" step needed.
 */
export async function joinHostelWaitlist(studentId: string, hostelId: string) {
  await assertCanManageHostel(hostelId);
  const admin = createAdminClient();

  const { error } = await admin.rpc("join_hostel_waitlist", {
    p_student_id: studentId,
    p_hostel_id: hostelId,
  });
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/hostels");
  revalidatePath("/dashboard/hostels");
}

export async function cancelHostelWaitlistEntry(entryId: string, hostelId: string) {
  await assertCanManageHostel(hostelId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("hostel_waitlist")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", entryId)
    .is("fulfilled_at", null)
    .is("cancelled_at", null);
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/hostels");
  revalidatePath("/dashboard/hostels");
}
