import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueueSupabaseMock, type MockResult } from "./helpers/supabaseMock";

// vi.mock(...) factories are hoisted above ordinary declarations, so any
// variable they close over has to come from vi.hoisted() -- a plain
// `const`/`let` here would be in the temporal dead zone when the factory
// actually runs (triggered by the hoisted import below).
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
const adminState = vi.hoisted(() => ({
  queue: [] as MockResult[],
  // Memoized per test so multiple createAdminClient() calls within one
  // test share a single queue position instead of each resetting its own
  // counter to 0 -- see the matching comment in tests/fees.test.ts, where
  // this actually bit a test (recordPayment calls createAdminClient()
  // twice per invocation). assertRole itself only calls it once, but
  // this stays consistent in case a future test here exercises a path
  // that calls it more than once.
  client: null as ReturnType<typeof createQueueSupabaseMock> | null,
}));

// getAuthenticatedUser (called by assertRole) goes through createClient()
// + getUserWithRetry(supabase) from lib/supabase/server. createClient's
// return value is never inspected by the mocked getUserWithRetry, so it
// can be an inert stub.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({})),
  getUserWithRetry,
}));

// assertRole re-reads the profile row via createAdminClient() (the
// service-role client) rather than trusting the session -- see its doc
// comment in lib/actions/authGuards.ts. adminState.queue is read fresh
// each time createAdminClient() is called, so each test just sets it
// before calling assertRole.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    adminState.client ??= createQueueSupabaseMock(adminState.queue);
    return adminState.client;
  }),
}));

import { assertRole, getAuthenticatedUser } from "@/lib/actions/authGuards";
import { TRANSIENT_AUTH_ERROR_MESSAGE } from "@/lib/authErrors";

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

describe("assertRole", () => {
  it("rejects a deactivated account even with an otherwise-allowed role", async () => {
    mockAuthenticatedAs("user-1");
    adminState.queue = [{ data: { role: "teacher", is_active: false }, error: null }];

    await expect(assertRole(["teacher"], "Not allowed.")).rejects.toThrow("Not allowed.");
  });

  it("rejects a role not in the allowed list, even when active", async () => {
    mockAuthenticatedAs("user-2");
    adminState.queue = [{ data: { role: "student", is_active: true }, error: null }];

    await expect(assertRole(["admin", "teacher"], "Not allowed.")).rejects.toThrow("Not allowed.");
  });

  it("allows an active account whose role is in the allowed list", async () => {
    mockAuthenticatedAs("user-3");
    adminState.queue = [{ data: { role: "admin", is_active: true }, error: null }];

    await expect(assertRole(["admin"], "Not allowed.")).resolves.toEqual({
      id: "user-3",
      role: "admin",
    });
  });

  it("rejects when no profile row is found at all", async () => {
    mockAuthenticatedAs("user-4");
    adminState.queue = [{ data: null, error: null }];

    await expect(assertRole(["admin"], "Not allowed.")).rejects.toThrow("Not allowed.");
  });

  it("surfaces a transient-network profile fetch failure distinctly from a real auth rejection", async () => {
    mockAuthenticatedAs("user-5");
    adminState.queue = [{ data: null, error: { message: "TypeError: fetch failed" } }];

    // Distinct from "Not allowed." -- a network blip fetching the profile
    // row must not be indistinguishable from an actual authorization
    // rejection, since the caller-supplied errorMessage would otherwise
    // wrongly tell a legitimately-active admin they're not allowed to do
    // something, when the real problem was Supabase being unreachable.
    await expect(assertRole(["admin"], "Not allowed.")).rejects.toThrow(TRANSIENT_AUTH_ERROR_MESSAGE);
  });

  it("propagates getAuthenticatedUser's transient-auth error without ever reaching the profile lookup", async () => {
    getUserWithRetry.mockResolvedValue({
      user: null,
      error: { message: "AuthRetryableFetchError: fetch failed" },
      isTransient: true,
    });
    adminState.queue = []; // any admin call here is a bug -- the queue is empty on purpose

    await expect(assertRole(["admin"], "Not allowed.")).rejects.toThrow(TRANSIENT_AUTH_ERROR_MESSAGE);
  });

  it("rejects with 'You must be signed in.' when there is genuinely no user", async () => {
    getUserWithRetry.mockResolvedValue({ user: null, error: null, isTransient: false });

    await expect(assertRole(["admin"], "Not allowed.")).rejects.toThrow("You must be signed in.");
  });
});

describe("getAuthenticatedUser", () => {
  it("returns the user when authenticated", async () => {
    mockAuthenticatedAs("user-6");
    await expect(getAuthenticatedUser()).resolves.toEqual({ id: "user-6" });
  });

  it("throws the shared transient-auth message on a retryable fetch failure", async () => {
    getUserWithRetry.mockResolvedValue({
      user: null,
      error: { message: "fetch failed" },
      isTransient: true,
    });

    await expect(getAuthenticatedUser()).rejects.toThrow(TRANSIENT_AUTH_ERROR_MESSAGE);
  });
});