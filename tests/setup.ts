import { vi } from "vitest";

// assertRole calls assertLicenseWritable() on every guarded action. Tests
// that exercise actions shouldn't each have to mock the license lookup, so
// it is a no-op by default. Tests that care import the mocked function and
// make it reject, and tests/license-guard.test.ts unmocks it to test the
// real implementation.
vi.mock("@/lib/actions/licenseGuard", () => ({
  assertLicenseWritable: vi.fn(async () => undefined),
  assertFeature: vi.fn(async () => undefined),
}));
