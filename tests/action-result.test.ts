import { describe, expect, it } from "vitest";
import { runAction, unwrapAction } from "@/lib/actionResult";

describe("runAction", () => {
  it("returns { ok: true } for a void action", async () => {
    expect(await runAction(async () => {})).toEqual({ ok: true });
  });

  it("returns the data on success", async () => {
    expect(await runAction(async () => ({ id: "x" }))).toEqual({ ok: true, data: { id: "x" } });
  });

  it("returns a thrown Error's real message instead of throwing", async () => {
    const result = await runAction(async () => {
      throw new Error("Only an admin can do this.");
    });
    expect(result).toEqual({ ok: false, error: "Only an admin can do this." });
  });

  it("falls back to a generic message for non-Error throws", async () => {
    expect(await runAction(async () => Promise.reject("nope"))).toEqual({
      ok: false,
      error: "Something went wrong.",
    });
  });

  it("re-throws Next.js redirect/notFound control-flow errors", async () => {
    const redirectLike = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    await expect(
      runAction(async () => {
        throw redirectLike;
      })
    ).rejects.toBe(redirectLike);
  });
});

describe("unwrapAction", () => {
  it("returns the data on success", async () => {
    expect(await unwrapAction(runAction(async () => 42))).toBe(42);
  });

  it("returns undefined for a void action", async () => {
    expect(await unwrapAction(runAction(async () => {}))).toBeUndefined();
  });

  it("throws an Error carrying the real message on failure", async () => {
    await expect(
      unwrapAction(
        runAction(async () => {
          throw new Error("Invoice not found.");
        })
      )
    ).rejects.toThrow("Invoice not found.");
  });
});
