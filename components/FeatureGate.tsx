import { FeatureLocked } from "@/components/FeatureLocked";
import type { LicenseFeature } from "@/lib/features";
import { licenseHasFeature } from "@/lib/license";
import { getLicenseInfo } from "@/lib/licenseInfo";
import { getCurrentProfile } from "@/lib/supabase/server";

/**
 * Wraps an add-on's route segment: renders the page when the school may use
 * the feature, otherwise a "not in your plan" screen. This hides the pages;
 * server actions and the database enforce the same rule separately.
 */
export async function FeatureGate({
  feature,
  children,
}: {
  feature: LicenseFeature;
  children: React.ReactNode;
}) {
  const info = await getLicenseInfo();
  if (licenseHasFeature(info, feature)) return <>{children}</>;

  const profile = await getCurrentProfile();
  return (
    <FeatureLocked
      feature={feature}
      expired={info.status === "expired"}
      isAdmin={profile?.role === "admin"}
    />
  );
}
