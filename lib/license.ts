// School licensing, app side. Pure helpers only (no I/O) so they can be
// used from server and client code and unit-tested. The database is the
// source of truth: license_status() in supabase/migrations/
// 20261019120000_school_license.sql derives the same four states from the
// clock, and this file mirrors it for display (days left, banner text).

import { LICENSE_FEATURES, type LicenseFeature } from "@/lib/features";

export type LicenseStatus = "none" | "active" | "grace" | "expired";

export type LicenseInfo = {
  status: LicenseStatus;
  isTrial: boolean;
  validUntil: string | null;
  graceUntil: string | null;
  /** Enabled add-on keys. null means no license row: every feature is on. */
  features: string[] | null;
};

/** Shown when no license row exists (legacy or development database). */
export const UNLICENSED_INFO: LicenseInfo = {
  status: "none",
  isTrial: false,
  validUntil: null,
  graceUntil: null,
  features: null,
};

/** Message shown when a write is refused because the school's license has lapsed. */
export const LICENSE_EXPIRED_MESSAGE =
  "This school's subscription has lapsed, so the app is read-only. Please ask your school admin to renew.";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors license_status() in the database. Used only for display. */
export function computeLicenseStatus(
  validUntil: string | null,
  graceUntil: string | null,
  now: Date = new Date()
): LicenseStatus {
  if (!validUntil || !graceUntil) return "none";
  const t = now.getTime();
  if (t <= new Date(validUntil).getTime()) return "active";
  if (t <= new Date(graceUntil).getTime()) return "grace";
  return "expired";
}

/**
 * Mirrors license_has(): no license row has every feature, an expired
 * license has none, otherwise the feature must be in the school's list.
 */
export function licenseHasFeature(info: LicenseInfo, feature: string): boolean {
  if (info.status === "none") return true;
  if (info.status === "expired") return false;
  return info.features?.includes(feature) ?? false;
}

/** The add-ons the school may use right now, in LICENSE_FEATURES order. */
export function enabledFeatures(info: LicenseInfo): LicenseFeature[] {
  return LICENSE_FEATURES.filter((f) => licenseHasFeature(info, f));
}

/** Mirrors license_active(): writes are allowed unless the license has expired. */
export function isLicenseWritable(status: LicenseStatus): boolean {
  return status !== "expired";
}

/** Whole days from `now` until `target`, rounded up; 0 when already past. */
export function daysUntil(target: string | null, now: Date = new Date()): number {
  if (!target) return 0;
  const diff = new Date(target).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

export type LicenseBanner = {
  tone: "info" | "warning" | "danger";
  message: string;
};

/**
 * The banner for the current license state, or null when nothing needs
 * saying. Trial schools see a countdown in the last 7 days; a paid school
 * is warned in the last 14 days, during grace, and when expired.
 */
export function licenseBanner(info: LicenseInfo, now: Date = new Date()): LicenseBanner | null {
  switch (info.status) {
    case "none":
      return null;
    case "active": {
      const left = daysUntil(info.validUntil, now);
      if (info.isTrial) {
        if (left > 7) return null;
        return {
          tone: left <= 3 ? "warning" : "info",
          message: `Your free trial ends in ${left} ${left === 1 ? "day" : "days"}.`,
        };
      }
      if (left > 14) return null;
      return {
        tone: "info",
        message: `Your subscription renews in ${left} ${left === 1 ? "day" : "days"}.`,
      };
    }
    case "grace": {
      const left = daysUntil(info.graceUntil, now);
      return {
        tone: "warning",
        message: `${info.isTrial ? "Your trial" : "Your subscription"} has ended. Everything still works for ${left} more ${left === 1 ? "day" : "days"}, then the app becomes read-only.`,
      };
    }
    case "expired":
      return {
        tone: "danger",
        message:
          "This school's subscription has lapsed, so the app is read-only. Fee payments, receipts, report cards and exports still work.",
      };
  }
}

/**
 * Soft warning for the school admin once the active student count reaches
 * the included threshold. Informational only: access is never blocked over
 * the cap, extra students are invoiced at the next true-up.
 */
export function studentCapBanner(
  studentCount: number,
  studentCap: number | null
): LicenseBanner | null {
  if (!studentCap || studentCount < studentCap) return null;
  if (studentCount === studentCap) {
    return {
      tone: "info",
      message: `You have reached the ${studentCap} students included in your plan. Access is never blocked; any extra students are invoiced at the next true-up.`,
    };
  }
  const extra = studentCount - studentCap;
  return {
    tone: "warning",
    message: `You have ${studentCount} active students, ${extra} over the ${studentCap} included in your plan. Access is never blocked; the extra ${extra === 1 ? "student is" : "students are"} invoiced at the next true-up.`,
  };
}

export const STATUS_LABELS: Record<LicenseStatus, string> = {
  none: "No license on file",
  active: "Active",
  grace: "Grace period",
  expired: "Expired (read-only)",
};
