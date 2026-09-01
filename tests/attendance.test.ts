import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

// Same vi.hoisted pattern as tests/authGuards.test.ts and tests/fees.test.ts
// -- see their comments for why a plain const/let can't be closed over by
// a vi.mock factory.
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));

const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));

// markAttendance does its own queries (class lookup + attendance upsert)
// through createClient(), separately from assertRole's createAdminClient()
// call -- so this needs its own queue/client, distinct from adminState.
const clientState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => {
    clientState.client ??= createQueueSupabaseMock(clientState.queue);
    return clientState.client;
  }),
  getUserWithRetry,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    adminState.client ??= createQueueSupabaseMock(adminState.queue);
    return adminState.client;
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

import { markAttendance } from "@/lib/actions/teacher";

function mockAuthenticatedAs(userId: string) {
  getUserWithRetry.mockResolvedValue({
    user: { id: userId },
    error: null,
    isTransient: false,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  adminState.queue = [];
  adminState.client = null;
  clientState.queue = [];
  clientState.client = null;
});

describe("markAttendance", () => {
  it("rejects a teacher who isn't the class teacher for the target class", async () => {
    mockAuthenticatedAs("teacher-subject-1");
    adminState.queue = [
      // assertRole(["teacher"], ...) profile lookup
      { data: { role: "teacher", is_active: true }, error: null },
    ];
    clientState.queue = [
      // classes lookup -- class_teacher_id belongs to someone else
      {
        data: { name: "JSS 1", arm: "A", class_teacher_id: "teacher-owner-1" },
        error: null,
      },
    ];

    await expect(
      markAttendance("class-1", "2026-09-01", [{ studentId: "student-1", status: "present" }])
    ).rejects.toThrow(/aren't the class teacher/);
  });

  it("rejects when the class doesn't exist", async () => {
    mockAuthenticatedAs("teacher-1");
    adminState.queue = [{ data: { role: "teacher", is_active: true }, error: null }];
    clientState.queue = [{ data: null, error: null }];

    await expect(
      markAttendance("missing-class", "2026-09-01", [{ studentId: "student-1", status: "present" }])
    ).rejects.toThrow(/Class not found/);
  });

  it("rejects a non-teacher role outright, before any class lookup", async () => {
    mockAuthenticatedAs("admin-1");
    // assertRole itself throws for a disallowed role -- markAttendance never
    // reaches its own createClient() calls, so clientState.queue stays
    // empty and unused, proving the class lookup never runs.
    adminState.queue = [{ data: { role: "admin", is_active: true }, error: null }];

    await expect(
      markAttendance("class-1", "2026-09-01", [{ studentId: "student-1", status: "present" }])
    ).rejects.toThrow(/Only teachers can mark attendance/);
  });

  it("upserts one row per student, keyed by class/student/date, for the actual class teacher", async () => {
    mockAuthenticatedAs("teacher-owner-1");
    adminState.queue = [{ data: { role: "teacher", is_active: true }, error: null }];
    clientState.queue = [
      {
        data: { name: "JSS 1", arm: "A", class_teacher_id: "teacher-owner-1" },
        error: null,
      },
      // attendance upsert
      { data: null, error: null },
    ];

    await markAttendance("class-1", "2026-09-01", [
      { studentId: "student-1", status: "present" },
      { studentId: "student-2", status: "absent" },
    ]);

    const attendanceClient = clientState.client!;
    const upsertCalls = (attendanceClient.from as ReturnType<typeof vi.fn>).mock.results;
    // Confirm the attendance builder's upsert was actually invoked with
    // one row per student and the class/student/date conflict key --
    // this is what makes the (class_id, student_id, date) unique
    // constraint from the migration actually get exercised correctly
    // rather than silently colliding or duplicating.
    const attendanceBuilder = upsertCalls[1].value;
    expect(attendanceBuilder.upsert).toHaveBeenCalledWith(
      [
        {
          class_id: "class-1",
          student_id: "student-1",
          date: "2026-09-01",
          status: "present",
          marked_by: "teacher-owner-1",
        },
        {
          class_id: "class-1",
          student_id: "student-2",
          date: "2026-09-01",
          status: "absent",
          marked_by: "teacher-owner-1",
        },
      ],
      { onConflict: "class_id,student_id,date" }
    );

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/teacher/attendance/class-1/2026-09-01");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/teacher/attendance");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/admin/students/student-1/attendance");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/admin/students/student-2/attendance");
  });

  it("surfaces a database error from the upsert via throwDbError instead of swallowing it", async () => {
    mockAuthenticatedAs("teacher-owner-1");
    adminState.queue = [{ data: { role: "teacher", is_active: true }, error: null }];
    clientState.queue = [
      {
        data: { name: "JSS 1", arm: null, class_teacher_id: "teacher-owner-1" },
        error: null,
      },
      // Simulate the unique constraint or another DB-level failure on upsert.
      { data: null, error: { code: "23505", message: "duplicate key value" } },
    ];

    await expect(
      markAttendance("class-1", "2026-09-01", [{ studentId: "student-1", status: "present" }])
    ).rejects.toThrow();
  });
});
