import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

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

import { approveLessonPlan, rejectLessonPlan } from "@/lib/actions/lessonPlanModeration";

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

// Same principal-level HOD change as grades-moderation.test.ts, applied to
// lesson-plan review -- see 20260921184114_hod_principal_wide_approval.sql.
describe("lesson plan moderation: HOD is school-wide, not scoped to subjects_taught", () => {
  it("lets a HOD approve a lesson plan outside their subjects_taught", async () => {
    mockAuthenticatedAs("hod-1");
    adminState.queue = [
      { data: { topic_id: "topic-outside-hod-department", status: "published", curriculum_topics: { title: "Photosynthesis" } }, error: null }, // topic_notes lookup
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { role: "teacher" }, error: null }, // not admin
      { data: { staff_role: "hod" }, error: null }, // hod -- no department check
      { data: null, error: null }, // topic_notes.update
      { data: null, error: null }, // writeAuditLog insert
    ];

    await expect(approveLessonPlan("note-1")).resolves.toBeUndefined();
  });

  it("lets an admin approve a lesson plan regardless of any HOD department logic", async () => {
    mockAuthenticatedAs("admin-1");
    adminState.queue = [
      { data: { topic_id: "topic-1", status: "published", curriculum_topics: { title: "Photosynthesis" } }, error: null },
      { data: { role: "admin", is_active: true }, error: null }, // assertRole
      { data: { role: "admin" }, error: null }, // short-circuits before teacher_profiles lookup
      { data: null, error: null }, // topic_notes.update
      { data: null, error: null }, // writeAuditLog insert
    ];

    await expect(approveLessonPlan("note-1")).resolves.toBeUndefined();
  });

  it("rejects a non-HOD teacher even for a topic in a subject they teach", async () => {
    mockAuthenticatedAs("teacher-1");
    adminState.queue = [
      { data: { topic_id: "topic-1", status: "published", curriculum_topics: { title: "Photosynthesis" } }, error: null },
      { data: { role: "teacher", is_active: true }, error: null }, // assertRole
      { data: { role: "teacher" }, error: null }, // not admin
      { data: { staff_role: "class_teacher" }, error: null }, // not hod
    ];

    await expect(rejectLessonPlan("note-1", "needs revision")).rejects.toThrow(
      "Only an admin or HOD can review lesson plans."
    );
  });

  it("rejects a student before any DB write", async () => {
    mockAuthenticatedAs("student-1");
    adminState.queue = [
      { data: { topic_id: "topic-1", status: "published", curriculum_topics: { title: "Photosynthesis" } }, error: null },
      { data: { role: "student", is_active: true }, error: null }, // assertRole
    ];

    await expect(approveLessonPlan("note-1")).rejects.toThrow(
      "Only an admin or HOD can review lesson plans."
    );
  });

  it("rejects reviewing a note that hasn't been published yet, before checking role", async () => {
    mockAuthenticatedAs("hod-1");
    adminState.queue = [
      { data: { topic_id: "topic-1", status: "draft", curriculum_topics: { title: "Photosynthesis" } }, error: null },
    ];

    await expect(approveLessonPlan("note-1")).rejects.toThrow(
      "Only a published note can be reviewed"
    );
  });
});
