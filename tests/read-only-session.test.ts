import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  READ_ONLY_MESSAGE,
  assertNotReadOnly,
  isReadOnlySessionExpired,
  isReadOnlyUser,
  readOnlyUntil,
} from "@/lib/readOnlySession";

const NOW = new Date("2026-10-22T10:00:00Z");
const supportUser = (until?: string) => ({
  app_metadata: { read_only: true, ...(until ? { read_only_until: until } : {}) },
});

describe("read-only session helpers", () => {
  it("recognises only an app_metadata flag set to true", () => {
    expect(isReadOnlyUser(supportUser("2026-10-22T10:30:00Z"))).toBe(true);
    expect(isReadOnlyUser({ app_metadata: { read_only: "true" } })).toBe(false);
    expect(isReadOnlyUser({ app_metadata: {} })).toBe(false);
    expect(isReadOnlyUser({ app_metadata: null })).toBe(false);
    expect(isReadOnlyUser(null)).toBe(false);
    expect(isReadOnlyUser(undefined)).toBe(false);
  });

  it("ignores user_metadata, which users can edit themselves", () => {
    expect(isReadOnlyUser({ app_metadata: {}, user_metadata: { read_only: true } } as never)).toBe(
      false
    );
  });

  it("reads the end time", () => {
    expect(readOnlyUntil(supportUser("2026-10-22T10:30:00Z"))?.toISOString()).toBe(
      "2026-10-22T10:30:00.000Z"
    );
    expect(readOnlyUntil(supportUser("not a date"))).toBeNull();
    expect(readOnlyUntil(supportUser())).toBeNull();
  });

  it("is not expired before the end time, and expired at and after it", () => {
    const user = supportUser("2026-10-22T10:30:00Z");
    expect(isReadOnlySessionExpired(user, NOW)).toBe(false);
    expect(isReadOnlySessionExpired(user, new Date("2026-10-22T10:30:00Z"))).toBe(true);
    expect(isReadOnlySessionExpired(user, new Date("2026-10-22T11:00:00Z"))).toBe(true);
  });

  it("treats a read-only user with no valid end time as expired, so it is never a standing login", () => {
    expect(isReadOnlySessionExpired(supportUser(), NOW)).toBe(true);
    expect(isReadOnlySessionExpired(supportUser("garbage"), NOW)).toBe(true);
  });

  it("never expires an ordinary user", () => {
    expect(isReadOnlySessionExpired({ app_metadata: {} }, NOW)).toBe(false);
    expect(isReadOnlySessionExpired(null, NOW)).toBe(false);
  });

  it("assertNotReadOnly throws only for support sessions", () => {
    expect(() => assertNotReadOnly(supportUser("2026-10-22T10:30:00Z"))).toThrow(READ_ONLY_MESSAGE);
    expect(() => assertNotReadOnly({ app_metadata: {} })).not.toThrow();
  });
});

// assertRole: every guarded action is a write unless it opts out.
const { getUserWithRetry } = vi.hoisted(() => ({ getUserWithRetry: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({})),
  getUserWithRetry,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "admin", is_active: true }, error: null }),
        }),
      }),
    }),
  })),
}));

import { assertRole } from "@/lib/actions/authGuards";

describe("assertRole in a read-only support session", () => {
  beforeEach(() => getUserWithRetry.mockReset());

  function signInAs(appMetadata: Record<string, unknown>) {
    getUserWithRetry.mockResolvedValue({
      user: { id: "u1", app_metadata: appMetadata },
      error: null,
      isTransient: false,
    });
  }

  it("refuses an ordinary guarded action", async () => {
    signInAs({ read_only: true, read_only_until: "2026-10-22T10:30:00Z" });
    await expect(assertRole(["admin"], "Admins only.")).rejects.toThrow(READ_ONLY_MESSAGE);
  });

  it("refuses an action that is allowed when the license has expired but writes (e.g. fee payment)", async () => {
    signInAs({ read_only: true, read_only_until: "2026-10-22T10:30:00Z" });
    await expect(assertRole(["admin"], "Admins only.", { allowWhenExpired: true })).rejects.toThrow(
      READ_ONLY_MESSAGE
    );
  });

  it("allows a pure read that opts out", async () => {
    signInAs({ read_only: true, read_only_until: "2026-10-22T10:30:00Z" });
    await expect(
      assertRole(["admin"], "Admins only.", { allowWhenExpired: true, allowWhenReadOnly: true })
    ).resolves.toEqual({ id: "u1", role: "admin" });
  });

  it("does not affect an ordinary admin", async () => {
    signInAs({});
    await expect(assertRole(["admin"], "Admins only.")).resolves.toEqual({
      id: "u1",
      role: "admin",
    });
  });
});
