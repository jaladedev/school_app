import { describe, expect, it } from "vitest";
import {
  computeLicenseStatus,
  daysUntil,
  enabledFeatures,
  isLicenseWritable,
  licenseBanner,
  licenseHasFeature,
  studentCapBanner,
  type LicenseInfo,
} from "@/lib/license";

const now = new Date("2026-10-20T12:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

const info = (over: Partial<LicenseInfo>): LicenseInfo => ({
  status: "active",
  isTrial: false,
  validUntil: inDays(100),
  graceUntil: inDays(121),
  features: [],
  ...over,
});

describe("computeLicenseStatus", () => {
  it("is none without dates", () => {
    expect(computeLicenseStatus(null, null, now)).toBe("none");
  });
  it("walks active, grace, expired", () => {
    expect(computeLicenseStatus(inDays(1), inDays(22), now)).toBe("active");
    expect(computeLicenseStatus(inDays(-1), inDays(20), now)).toBe("grace");
    expect(computeLicenseStatus(inDays(-30), inDays(-1), now)).toBe("expired");
  });
  it("treats the exact valid_until instant as still active", () => {
    expect(computeLicenseStatus(now.toISOString(), inDays(21), now)).toBe("active");
  });
});

describe("isLicenseWritable", () => {
  it("only blocks when expired", () => {
    expect(isLicenseWritable("none")).toBe(true);
    expect(isLicenseWritable("active")).toBe(true);
    expect(isLicenseWritable("grace")).toBe(true);
    expect(isLicenseWritable("expired")).toBe(false);
  });
});

describe("daysUntil", () => {
  it("rounds partial days up and floors at zero", () => {
    expect(daysUntil(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(1);
    expect(daysUntil(inDays(5), now)).toBe(5);
    expect(daysUntil(inDays(-2), now)).toBe(0);
    expect(daysUntil(null, now)).toBe(0);
  });
});

describe("licenseBanner", () => {
  it("shows nothing when unlicensed or far from the end", () => {
    expect(licenseBanner(info({ status: "none" }), now)).toBeNull();
    expect(licenseBanner(info({}), now)).toBeNull();
    expect(licenseBanner(info({ isTrial: true, validUntil: inDays(20) }), now)).toBeNull();
  });
  it("counts down the last week of a trial", () => {
    const b = licenseBanner(info({ isTrial: true, validUntil: inDays(3) }), now);
    expect(b?.tone).toBe("warning");
    expect(b?.message).toContain("3 days");
    expect(licenseBanner(info({ isTrial: true, validUntil: inDays(1) }), now)?.message).toContain(
      "1 day."
    );
  });
  it("warns a paid school in its last 14 days", () => {
    const b = licenseBanner(info({ validUntil: inDays(10) }), now);
    expect(b?.tone).toBe("info");
    expect(b?.message).toContain("10 days");
  });
  it("explains grace and expiry", () => {
    const g = licenseBanner(
      info({ status: "grace", validUntil: inDays(-1), graceUntil: inDays(6) }),
      now
    );
    expect(g?.tone).toBe("warning");
    expect(g?.message).toContain("6 more days");
    const e = licenseBanner(info({ status: "expired" }), now);
    expect(e?.tone).toBe("danger");
    expect(e?.message).toContain("read-only");
  });
});

describe("licenseHasFeature / enabledFeatures", () => {
  it("gives every feature to a database with no license row", () => {
    const none = info({ status: "none", features: null });
    expect(licenseHasFeature(none, "transport")).toBe(true);
    expect(enabledFeatures(none)).toHaveLength(6);
  });
  it("only gives the listed features while active or in grace", () => {
    for (const status of ["active", "grace"] as const) {
      const i = info({ status, features: ["messaging", "library"] });
      expect(licenseHasFeature(i, "messaging")).toBe(true);
      expect(licenseHasFeature(i, "transport")).toBe(false);
      expect(enabledFeatures(i)).toEqual(["messaging", "library"]);
    }
  });
  it("switches every add-on off once expired, even ones the school bought", () => {
    const i = info({ status: "expired", features: ["messaging"] });
    expect(licenseHasFeature(i, "messaging")).toBe(false);
    expect(enabledFeatures(i)).toEqual([]);
  });
});

describe("studentCapBanner", () => {
  it("says nothing below the cap or without one", () => {
    expect(studentCapBanner(299, 300)).toBeNull();
    expect(studentCapBanner(500, null)).toBeNull();
  });
  it("notes reaching the cap, and warns when over it, without ever blocking", () => {
    expect(studentCapBanner(300, 300)?.tone).toBe("info");
    const over = studentCapBanner(312, 300);
    expect(over?.tone).toBe("warning");
    expect(over?.message).toContain("12 over");
    expect(over?.message).toContain("never blocked");
    expect(studentCapBanner(301, 300)?.message).toContain("extra student is invoiced");
  });
});

describe("licensing errors from the database", () => {
  it("passes a license_require message through instead of the generic permission text", async () => {
    const { mapDbError } = await import("@/lib/errors/db");
    const lapsed = "This school's subscription has lapsed, so changes are not allowed.";
    expect(mapDbError({ code: "42501", message: lapsed })).toBe(lapsed);
    const feature = "The hostel feature is not included in this school's plan.";
    expect(mapDbError({ code: "42501", message: feature })).toBe(feature);
  });
  it("keeps the generic text for an ordinary RLS denial", async () => {
    const { mapDbError } = await import("@/lib/errors/db");
    expect(
      mapDbError({
        code: "42501",
        message: 'new row violates row-level security policy for table "x"',
      })
    ).toBe("You don't have permission to do that.");
  });
});

describe("isNextControlFlowError", () => {
  it("recognises Next's rendering-control errors so they are rethrown, not swallowed", async () => {
    const { isNextControlFlowError } = await import("@/lib/nextErrors");
    expect(
      isNextControlFlowError(Object.assign(new Error("x"), { digest: "DYNAMIC_SERVER_USAGE" }))
    ).toBe(true);
    expect(isNextControlFlowError({ digest: "NEXT_REDIRECT;replace;/login;307;" })).toBe(true);
    expect(isNextControlFlowError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
  });
  it("does not treat ordinary failures as control flow", async () => {
    const { isNextControlFlowError } = await import("@/lib/nextErrors");
    expect(isNextControlFlowError(new Error("fetch failed"))).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError({ digest: 42 })).toBe(false);
  });
});
