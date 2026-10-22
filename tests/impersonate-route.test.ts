import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signImpersonationToken } from "@/lib/impersonation";

const SECRET = "a-school-specific-secret-of-at-least-32-chars";

const mocks = vi.hoisted(() => ({
  insertLink: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  prepareSupportViewer: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    SCHOOL_SLUG: "greenfield",
    IMPERSONATION_SIGNING_SECRET: "a-school-specific-secret-of-at-least-32-chars",
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ insert: mocks.insertLink }),
    auth: { admin: { generateLink: mocks.generateLink } },
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { verifyOtp: mocks.verifyOtp } })),
}));
vi.mock("@/lib/actions/supportViewer", () => ({
  SUPPORT_VIEWER_EMAIL: "platform-support@support.invalid",
  prepareSupportViewer: mocks.prepareSupportViewer,
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

import { GET } from "@/app/api/impersonate/route";

const request = (token?: string) =>
  new NextRequest(`https://school.example/api/impersonate${token ? `?token=${token}` : ""}`);
const validToken = (overrides: Partial<Parameters<typeof signImpersonationToken>[0]> = {}) =>
  signImpersonationToken({
    secret: SECRET,
    school: "greenfield",
    by: "support@example.com",
    ...overrides,
  });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.insertLink.mockResolvedValue({ error: null });
  mocks.prepareSupportViewer.mockResolvedValue({
    id: "viewer-1",
    until: new Date("2026-10-22T10:30:00Z"),
  });
  mocks.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "hash-1" } },
    error: null,
  });
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

async function refusedWith(token?: string) {
  const res = await GET(request(token));
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "This support link is invalid or has expired." });
  // Nothing was opened.
  expect(mocks.prepareSupportViewer).not.toHaveBeenCalled();
  expect(mocks.verifyOtp).not.toHaveBeenCalled();
  expect(mocks.writeAuditLog).not.toHaveBeenCalled();
}

describe("GET /api/impersonate", () => {
  it("opens a session for a valid link: marks it used, signs in, logs the start, goes to the dashboard", async () => {
    await expect(GET(request(validToken()))).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mocks.insertLink).toHaveBeenCalledWith({ jti: expect.any(String) });
    expect(mocks.prepareSupportViewer).toHaveBeenCalledWith(
      expect.anything(),
      "support@example.com"
    );
    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "platform-support@support.invalid",
    });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "impersonation.start",
        actorId: "viewer-1",
        metadata: expect.objectContaining({ support_user: "support@example.com" }),
      })
    );
  });

  it("refuses a request with no token", async () => {
    await refusedWith(undefined);
  });

  it("refuses a forged link", async () => {
    await refusedWith(validToken({ secret: "another-secret-that-is-also-at-least-32-chars" }));
  });

  it("refuses a link issued for another school", async () => {
    await refusedWith(validToken({ school: "riverside" }));
  });

  it("refuses an expired link", async () => {
    await refusedWith(validToken({ now: new Date(Date.now() - 20 * 60 * 1000), ttlSeconds: 60 }));
  });

  it("refuses a link that was already used", async () => {
    mocks.insertLink.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    await refusedWith(validToken());
  });

  it("refuses when it cannot record the link as used, rather than allowing a replay", async () => {
    mocks.insertLink.mockResolvedValue({ error: { code: "XX000", message: "db down" } });
    await refusedWith(validToken());
  });

  it("reports a failure to open the session, without logging a start", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "otp expired" } });
    const res = await GET(request(validToken()));
    expect(res.status).toBe(500);
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("reports a failure to prepare the support account", async () => {
    mocks.prepareSupportViewer.mockRejectedValue(new Error("boom"));
    const res = await GET(request(validToken()));
    expect(res.status).toBe(500);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
