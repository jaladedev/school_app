import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const state = vi.hoisted(() => ({
  queue: [] as MockResult[],
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));
const revalidatePath = vi.hoisted(() => vi.fn());

// One shared client for both the session client (entry/lesson reads and
// writes) and the service-role client (assertRole's profile lookup, audit
// log): the queue is positional, so a single instance keeps call order
// unambiguous.
const sharedClient = () => (state.client ??= createQueueSupabaseMock(state.queue));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => sharedClient()),
  getUserWithRetry,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => sharedClient()) }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { giveHomework, updateHomework } from "@/lib/actions/homework";

function mockAuthenticatedAs(userId: string) {
  getUserWithRetry.mockResolvedValue({ user: { id: userId }, error: null, isTransient: false });
}
const asTeacher: MockResult = { data: { role: "teacher", is_active: true }, error: null };
const asStudent: MockResult = { data: { role: "student", is_active: true }, error: null };
const ok: MockResult = { data: null, error: null };
const entry = (teacherId: string): MockResult => ({
  data: { teacher_id: teacherId, class_id: "class-1", classes: { name: "Primary 4", arm: null } },
  error: null,
});
const row = (data: unknown): MockResult => ({ data, error: null });
const today = new Date().toISOString().slice(0, 10);

afterEach(() => {
  vi.clearAllMocks();
  state.queue = [];
  state.client = null;
});

describe("giveHomework", () => {
  const base = { timetableEntryId: "entry-1", lessonDate: today, homework: "Read chapter 3" };

  it("creates a lesson carrying the homework when none is logged yet", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, entry("teacher-1"), row(null), row({ id: "lesson-9" }), ok];

    expect(await giveHomework(base)).toEqual({ ok: true, data: { lessonId: "lesson-9" } });
  });

  it("adds the homework to a lesson already logged for that period and date", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, entry("teacher-1"), row({ id: "lesson-1", homework: null }), ok, ok];

    expect(await giveHomework(base)).toEqual({ ok: true, data: { lessonId: "lesson-1" } });
  });

  it("refuses to overwrite homework already given for that lesson", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, entry("teacher-1"), row({ id: "lesson-1", homework: "old" })];

    const result = await giveHomework(base);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("already given");
  });

  it("rejects a timetable slot that belongs to another teacher", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, entry("teacher-2")];

    const result = await giveHomework(base);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("aren't assigned");
  });

  it("rejects a non-teacher", async () => {
    mockAuthenticatedAs("student-1");
    state.queue = [asStudent];

    expect((await giveHomework(base)).ok).toBe(false);
  });

  it("rejects a future lesson date and a due date before the lesson", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher];
    const future = await giveHomework({ ...base, lessonDate: "2099-01-01" });
    expect(future).toEqual({ ok: false, error: "The lesson date can't be in the future." });

    state.queue = [asTeacher];
    state.client = null;
    const early = await giveHomework({ ...base, homeworkDueAt: "2000-01-01" });
    expect(early).toEqual({
      ok: false,
      error: "Homework due date can't be before the lesson date.",
    });
  });
});

describe("updateHomework", () => {
  const lesson = (over: Record<string, unknown> = {}) =>
    row({
      teacher_id: "teacher-1",
      lesson_date: "2026-10-05",
      homework: "old text",
      homework_status: "given",
      ...over,
    });

  it("lets the teacher who gave it change the text and due date", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, lesson(), ok, ok];

    expect(
      await updateHomework("lesson-1", { homework: "new text", homeworkDueAt: "2026-10-12" })
    ).toEqual({ ok: true });
  });

  it("rejects editing homework someone else gave", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, lesson({ teacher_id: "teacher-2" })];

    expect(await updateHomework("lesson-1", { homework: "x" })).toEqual({
      ok: false,
      error: "You can only edit homework you gave.",
    });
  });

  it("rejects editing graded homework", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, lesson({ homework_status: "graded" })];

    expect(await updateHomework("lesson-1", { homework: "x" })).toEqual({
      ok: false,
      error: "Graded homework can't be edited. Reopen it first.",
    });
  });

  it("rejects a lesson that has no homework yet", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, lesson({ homework: null })];

    const result = await updateHomework("lesson-1", { homework: "x" });
    expect(!result.ok && result.error).toContain("no homework");
  });

  it("rejects blank text and a due date before the lesson date", async () => {
    mockAuthenticatedAs("teacher-1");
    state.queue = [asTeacher, lesson()];
    expect(await updateHomework("lesson-1", { homework: "  " })).toEqual({
      ok: false,
      error: "Write what the students should do.",
    });

    state.queue = [asTeacher, lesson()];
    state.client = null;
    expect(
      await updateHomework("lesson-1", { homework: "x", homeworkDueAt: "2026-10-01" })
    ).toEqual({ ok: false, error: "Homework due date can't be before the lesson date." });
  });
});
