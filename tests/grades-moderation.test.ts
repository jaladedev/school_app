import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

// Same vi.hoisted pattern as tests/fees-authorization.test.ts.
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({})),
  getUserWithRetry,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    adminState.client ??= createQueueSupabaseMock(adminState.queue);
    return adminState.client;
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

import { approveAssessmentGrades, approveSingleGrade } from "@/lib/actions/gradesModeration";

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
});

// HOD approval is school-wide (principal-level) as of
// 20260921184114_hod_principal_wide_approval.sql -- these tests exist to
// pin that down, since removing the old subjects_taught scoping had no
// prior test coverage in either direction.
describe("grade moderation: HOD is school-wide, not scoped to subjects_taught", () => {
  it("lets a HOD approve grades for an assessment outside their subjects_taught", async () => {
    mockAuthenticatedAs("hod-1");
    adminState.queue = [
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { role: "teacher" }, error: null }, // assertCanModerateAssessment's own profile lookup (not admin)
      { data: { staff_role: "hod" }, error: null }, // teacher_profiles -- no subjects_taught check anymore
      { data: null, error: null, count: 3 } as MockResult & { count: number }, // grades.update(...).eq(...).eq(...)
      { data: null, error: null }, // writeAuditLog insert
    ];

    const result = await approveAssessmentGrades("assessment-outside-hod-department");
    expect(result.count).toBe(3);
  });

  it("lets an admin approve grades regardless of any HOD department logic", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      { data: { role: "admin", is_active: true }, error: null }, // assertRole
      { data: { role: "admin" }, error: null }, // short-circuits before any teacher_profiles lookup
      { data: null, error: null, count: 1 } as MockResult & { count: number }, // grades.update
      { data: null, error: null }, // writeAuditLog insert
    ];

    const result = await approveAssessmentGrades("assessment-1");
    expect(result.count).toBe(1);
  });

  it("rejects a non-HOD teacher even for an assessment in a subject they teach", async () => {
    mockAuthenticatedAs("teacher-1");
    adminState.queue = [
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { role: "teacher" }, error: null }, // not admin
      { data: { staff_role: "class_teacher" }, error: null }, // not hod
    ];

    await expect(approveAssessmentGrades("assessment-1")).rejects.toThrow(
      "Only an admin or HOD can approve grades."
    );
  });

  it("rejects a student before any DB write", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [{ data: { role: "student", is_active: true }, error: null }];

    await expect(approveAssessmentGrades("assessment-1")).rejects.toThrow(
      "Only an admin or HOD can approve grades."
    );
  });

  it("rejects a deactivated HOD account", async () => {
    mockAuthenticatedAs("hod-deactivated");
    // assertRole itself rejects on is_active === false, before ever
    // reaching the HOD-specific check.
    adminState.queue = [{ data: { role: "teacher", is_active: false }, error: null }];

    await expect(approveAssessmentGrades("assessment-1")).rejects.toThrow(
      "Only an admin or HOD can approve grades."
    );
  });

  it("approveSingleGrade: lets a HOD approve a single grade outside their subjects_taught", async () => {
    mockAuthenticatedAs("hod-1");
    adminState.queue = [
      { data: { assessment_id: "assessment-outside-hod-department", student_id: "student-1" }, error: null }, // grade lookup
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { role: "teacher" }, error: null }, // not admin
      { data: { staff_role: "hod" }, error: null }, // hod -- no department check
      { data: null, error: null }, // grades.update by id
      { data: null, error: null }, // writeAuditLog insert
    ];

    await expect(approveSingleGrade("grade-1")).resolves.toBeUndefined();
  });
});
