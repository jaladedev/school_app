import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  UNLICENSED_INFO,
  enabledFeatures,
  type LicenseInfo,
  type LicenseStatus,
} from "@/lib/license";
import type { LicenseFeature } from "@/lib/features";
import { logger } from "@/lib/logger";
import { isNextControlFlowError } from "@/lib/nextErrors";

const KNOWN_STATUSES: LicenseStatus[] = ["none", "active", "grace", "expired"];

/**
 * The signed-in user's view of the license, for the banner. One database
 * call per request (React cache). If the call fails the app does NOT lock:
 * a lookup failure must never make a paying school read-only, so it falls
 * back to "no license" and logs the problem.
 */
export const getLicenseInfo = cache(async function getLicenseInfo(): Promise<LicenseInfo> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("license_info");
    if (error) throw error;
    const row = data?.[0];
    if (!row || !KNOWN_STATUSES.includes(row.status as LicenseStatus)) return UNLICENSED_INFO;
    return {
      status: row.status as LicenseStatus,
      isTrial: Boolean(row.is_trial),
      validUntil: row.valid_until,
      graceUntil: row.grace_until,
      features: row.features ?? null,
    };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.error("getLicenseInfo: could not read license, treating as unrestricted", {
      error: err,
    });
    return UNLICENSED_INFO;
  }
});

/** The add-ons this school may use right now (all of them when unlicensed). */
export const getEnabledFeatures = cache(async function getEnabledFeatures(): Promise<
  LicenseFeature[]
> {
  return enabledFeatures(await getLicenseInfo());
});

export type LicenseSummary = {
  status: LicenseStatus;
  session: string | null;
  isTrial: boolean;
  validUntil: string | null;
  graceUntil: string | null;
  studentCap: number | null;
  features: string[];
  studentCount: number;
};

/**
 * Admin-only detail for the settings page and the over-cap banner. The
 * database function refuses non-admins, so a null here means "not an admin
 * or the lookup failed"; callers should treat it as "nothing to show".
 */
export const getLicenseSummary = cache(
  async function getLicenseSummary(): Promise<LicenseSummary | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("license_summary");
      if (error) throw error;
      const row = data?.[0];
      if (!row || !KNOWN_STATUSES.includes(row.status as LicenseStatus)) return null;
      return {
        status: row.status as LicenseStatus,
        session: row.session,
        isTrial: Boolean(row.is_trial),
        validUntil: row.valid_until,
        graceUntil: row.grace_until,
        studentCap: row.student_cap,
        features: row.features ?? [],
        studentCount: row.student_count,
      };
    } catch (err) {
      if (isNextControlFlowError(err)) throw err;
      logger.error("getLicenseSummary: could not read license summary", { error: err });
      return null;
    }
  }
);
