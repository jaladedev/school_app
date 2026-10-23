import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_LINK_LIFETIME_SECONDS,
  signImpersonationToken,
  verifyImpersonationToken,
} from "@/lib/impersonation";

const SECRET = "a-school-specific-secret-of-at-least-32-chars";
const NOW = new Date("2026-10-22T10:00:00Z");
const base = { secret: SECRET, school: "greenfield", by: "support@example.com", now: NOW };

// Builds a validly signed token with arbitrary claims, to test the checks
// signImpersonationToken itself would never produce.
function signedWith(claims: Record<string, unknown>, secret = SECRET) {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
const iat = Math.floor(NOW.getTime() / 1000);
const goodClaims = { v: 1, sch: "greenfield", by: "x", jti: "j1", iat, exp: iat + 300 };

describe("verifyImpersonationToken", () => {
  it("accepts a fresh link for this school and returns who asked for it", () => {
    const token = signImpersonationToken(base);
    const result = verifyImpersonationToken(token, {
      secret: SECRET,
      school: "greenfield",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.by).toBe("support@example.com");
      expect(result.claims.sch).toBe("greenfield");
      expect(result.claims.jti).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("gives every link its own id", () => {
    const a = signImpersonationToken(base);
    const b = signImpersonationToken(base);
    const claims = (t: string) => JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    expect(claims(a).jti).not.toBe(claims(b).jti);
  });

  it("refuses a link signed with another school's secret", () => {
    const token = signImpersonationToken({
      ...base,
      secret: "another-schools-secret-also-32-characters",
    });
    expect(
      verifyImpersonationToken(token, { secret: SECRET, school: "greenfield", now: NOW })
    ).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses a link for a different school, even with a valid signature", () => {
    const token = signImpersonationToken({ ...base, school: "riverside" });
    expect(
      verifyImpersonationToken(token, { secret: SECRET, school: "greenfield", now: NOW })
    ).toEqual({
      ok: false,
      reason: "wrong_school",
    });
  });

  it("refuses a tampered body", () => {
    const [, signature] = signImpersonationToken(base).split(".");
    const forged = Buffer.from(JSON.stringify({ ...goodClaims, by: "someone-else" })).toString(
      "base64url"
    );
    expect(
      verifyImpersonationToken(`${forged}.${signature}`, {
        secret: SECRET,
        school: "greenfield",
        now: NOW,
      })
    ).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses an expired link", () => {
    const token = signImpersonationToken({ ...base, ttlSeconds: 60 });
    const later = new Date(NOW.getTime() + 61 * 1000);
    expect(
      verifyImpersonationToken(token, { secret: SECRET, school: "greenfield", now: later })
    ).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a link from the future (beyond a minute of clock difference)", () => {
    const token = signImpersonationToken({
      ...base,
      now: new Date(NOW.getTime() + 10 * 60 * 1000),
    });
    expect(
      verifyImpersonationToken(token, { secret: SECRET, school: "greenfield", now: NOW })
    ).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("caps the lifetime when signing", () => {
    const token = signImpersonationToken({ ...base, ttlSeconds: 24 * 3600 });
    const claims = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(claims.exp - claims.iat).toBe(MAX_LINK_LIFETIME_SECONDS);
  });

  it("refuses a validly signed link that lives longer than the cap", () => {
    const token = signedWith({ ...goodClaims, exp: iat + MAX_LINK_LIFETIME_SECONDS + 1 });
    expect(
      verifyImpersonationToken(token, { secret: SECRET, school: "greenfield", now: NOW })
    ).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it.each([
    ["no separator", "abc"],
    ["empty parts", "."],
    ["three parts", "a.b.c"],
    ["empty string", ""],
  ])("refuses a malformed token: %s", (_name, token) => {
    const result = verifyImpersonationToken(token, {
      secret: SECRET,
      school: "greenfield",
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it.each([
    ["wrong version", { ...goodClaims, v: 2 }],
    ["no who", { ...goodClaims, by: "" }],
    ["no id", { ...goodClaims, jti: "" }],
    ["non-numeric expiry", { ...goodClaims, exp: "soon" }],
  ])("refuses a signed token with bad claims: %s", (_name, claims) => {
    expect(
      verifyImpersonationToken(signedWith(claims), {
        secret: SECRET,
        school: "greenfield",
        now: NOW,
      })
    ).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

// The same literal token is asserted in the control plane's
// tests/impersonation-contract.test.ts. If either side changes the link
// format, its copy of this test fails.
describe("link format shared with the control plane", () => {
  const SECRET = "contract-vector-secret-0123456789abcdef";
  const VECTOR =
    "eyJ2IjoxLCJzY2giOiJncmVlbmZpZWxkIiwiYnkiOiJzdXBwb3J0QGV4YW1wbGUuY29tIiwianRpIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAxIiwiaWF0IjoxNzkyNzQ5NjAwLCJleHAiOjE3OTI3NDk5MDB9.NKQOOxMe-ECa300N7sEz7y1ST6GfyG22kBQNcwnFyQk";
  const now = new Date("2026-10-23T10:00:00Z");

  it("signs the agreed token byte for byte", () => {
    expect(
      signImpersonationToken({
        secret: SECRET,
        school: "greenfield",
        by: "support@example.com",
        ttlSeconds: 300,
        now,
        jti: "00000000-0000-4000-8000-000000000001",
      })
    ).toBe(VECTOR);
  });

  it("verifies the agreed token for its school only", () => {
    expect(verifyImpersonationToken(VECTOR, { secret: SECRET, school: "greenfield", now }).ok).toBe(
      true
    );
    expect(verifyImpersonationToken(VECTOR, { secret: SECRET, school: "other", now })).toEqual({
      ok: false,
      reason: "wrong_school",
    });
  });
});
