import { createAdminClient } from "@/lib/supabase/admin";
import { LICENSE_EXPIRED_MESSAGE, isLicenseWritable, type LicenseStatus } from "@/lib/license";
import { FEATURE_LABELS, type LicenseFeature } from "@/lib/features";
import { logger } from "@/lib/logger";

// Kept apart from lib/licenseInfo.ts on purpose: this file is imported by
// assertRole (lib/actions/authGuards.ts), so it must not pull in anything
// that needs the Next.js runtime (React cache, cookies).

/**
 * Throws when the school's license has expired. Server actions that write
 * through the service-role client (which bypasses the database's own
 * read-only policies) must call this first. Fails open on a lookup error,
 * for the same reason as getLicenseInfo.
 */
export async function assertLicenseWritable(): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("license_status");
  if (error) {
    logger.error("assertLicenseWritable: could not read license status, allowing write", {
      error,
    });
    return;
  }
  if (!isLicenseWritable(data as LicenseStatus)) {
    throw new Error(LICENSE_EXPIRED_MESSAGE);
  }
}

/**
 * Throws when the school's plan does not include an add-on (or the license
 * has expired, which switches every add-on off). Fails open on a lookup
 * error, like assertLicenseWritable.
 */
export async function assertFeature(feature: LicenseFeature): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("license_has", { p_feature: feature });
  if (error) {
    logger.error("assertFeature: could not read license, allowing", { feature, error });
    return;
  }
  if (data === false) {
    throw new Error(
      `${FEATURE_LABELS[feature].label} is not included in this school's plan. Please ask your school admin to add it.`
    );
  }
}
