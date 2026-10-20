import { describe, expect, it } from "vitest";
import {
  FEATURE_LABELS,
  LICENSE_FEATURES,
  featureForPath,
  filterNavByFeatures,
  isLicenseFeature,
} from "@/lib/features";

describe("featureForPath", () => {
  it.each([
    ["/dashboard/messages", "messaging"],
    ["/dashboard/messages/abc-123", "messaging"],
    ["/dashboard/transport", "transport"],
    ["/dashboard/driver", "transport"],
    ["/dashboard/admin/transport/routes", "transport"],
    ["/dashboard/parent/transport", "transport"],
    ["/dashboard/hostels/rooms/1", "hostel"],
    ["/dashboard/admin/hostels", "hostel"],
    ["/dashboard/library/loans", "library"],
    ["/dashboard/student/library", "library"],
    ["/dashboard/admin/bulk-email", "bulk_email"],
    ["/dashboard/admin/inventory", "inventory"],
    ["/dashboard/messages/?x=1", "messaging"],
  ])("%s belongs to %s", (path, feature) => {
    expect(featureForPath(path)).toBe(feature);
  });

  it("leaves core pages alone", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/admin",
      "/dashboard/admin/fees",
      "/dashboard/admin/license",
      "/dashboard/announcements",
      "/dashboard/student/report-card",
      "/dashboard/teacher/homework",
    ]) {
      expect(featureForPath(path)).toBeNull();
    }
  });

  it("matches at segment boundaries only", () => {
    expect(featureForPath("/dashboard/librarian-tools")).toBeNull();
    expect(featureForPath("/dashboard/messagesX")).toBeNull();
  });
});

describe("filterNavByFeatures", () => {
  const nav = [
    { label: "Overview", href: "/dashboard/admin" },
    { label: "Messages", href: "/dashboard/messages" },
    { label: "Transport", href: "/dashboard/admin/transport" },
    { label: "Library", href: "/dashboard/library" },
  ];
  it("hides only the add-ons that are off", () => {
    const result = filterNavByFeatures(nav, ["library"]);
    expect(result.map((i) => i.label)).toEqual(["Overview", "Library"]);
  });
  it("shows everything when every feature is on", () => {
    expect(filterNavByFeatures(nav, LICENSE_FEATURES)).toHaveLength(4);
  });
});

describe("feature metadata", () => {
  it("has a label for every feature and recognises only known keys", () => {
    for (const f of LICENSE_FEATURES) {
      expect(FEATURE_LABELS[f].label).toBeTruthy();
      expect(isLicenseFeature(f)).toBe(true);
    }
    expect(isLicenseFeature("payroll")).toBe(false);
  });
});
