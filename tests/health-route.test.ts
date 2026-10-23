import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ result: vi.fn() }));

vi.mock("@/lib/env.server", () => ({ serverEnv: { SCHOOL_SLUG: "greenfield" } }));
vi.mock("@/lib/env.edge", () => ({}));
vi.mock("@/lib/env.client", () => ({ readPublicConfigFromEnv: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: () => ({ limit: () => ({ abortSignal: () => mocks.result() }) }) }),
  })),
}));

import { GET } from "@/app/api/health/route";

const call = (qs = "") => GET(new NextRequest(`https://school.example/api/health${qs}`));

beforeEach(() => mocks.result.mockReset());

describe("/api/health", () => {
  it("is shallow by default: ok, version and slug, no database query", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: "greenfield" });
    expect(mocks.result).not.toHaveBeenCalled();
  });

  it("deep: ok when the database answers, reporting whether a licence row exists", async () => {
    mocks.result.mockResolvedValueOnce({ data: [{ version: 3 }], error: null });
    expect(await (await call("?deep=1")).json()).toMatchObject({ ok: true, license: true });
    mocks.result.mockResolvedValueOnce({ data: [], error: null });
    const none = await call("?deep=1");
    expect(none.status).toBe(200);
    expect(await none.json()).toMatchObject({ ok: true, license: false });
  });

  it("deep: 503 with the slug when the database or table cannot be read", async () => {
    mocks.result.mockResolvedValueOnce({ data: null, error: { message: "relation missing" } });
    const res = await call("?deep=1");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, slug: "greenfield" });
  });

  it("deep: 503 when the check times out", async () => {
    mocks.result.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    const res = await call("?deep=1");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/timed out/i);
  });
});
