import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/actions/licenseGuard");

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}));

import { assertFeature, assertLicenseWritable } from "@/lib/actions/licenseGuard";
import { LICENSE_EXPIRED_MESSAGE } from "@/lib/license";

describe("assertLicenseWritable", () => {
  beforeEach(() => rpc.mockReset());

  it.each(["active", "grace", "none"])("allows writes when status is %s", async (status) => {
    rpc.mockResolvedValue({ data: status, error: null });
    await expect(assertLicenseWritable()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("license_status");
  });

  it("refuses writes when expired", async () => {
    rpc.mockResolvedValue({ data: "expired", error: null });
    await expect(assertLicenseWritable()).rejects.toThrow(LICENSE_EXPIRED_MESSAGE);
  });

  it("fails open when the lookup itself errors, so a blip never locks a paying school", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    await expect(assertLicenseWritable()).resolves.toBeUndefined();
  });
});

describe("assertFeature", () => {
  beforeEach(() => rpc.mockReset());

  it("allows a feature the school has", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(assertFeature("transport")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("license_has", { p_feature: "transport" });
  });

  it("refuses a feature that is not in the plan, naming it", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(assertFeature("hostel")).rejects.toThrow(/Hostel is not included/);
  });

  it("fails open when the lookup errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    await expect(assertFeature("library")).resolves.toBeUndefined();
  });
});
