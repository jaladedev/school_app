import Link from "next/link";
import { FEATURE_LABELS, type LicenseFeature } from "@/lib/features";

/**
 * Shown in place of an add-on's pages when the school's plan doesn't
 * include it, or when a lapsed subscription has switched add-ons off.
 */
export function FeatureLocked({
  feature,
  expired,
  isAdmin,
}: {
  feature: LicenseFeature;
  expired: boolean;
  isAdmin: boolean;
}) {
  const { label } = FEATURE_LABELS[feature];
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold">
        {expired ? `${label} is switched off` : `${label} isn't part of your plan`}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {expired
          ? "This school's subscription has lapsed, so add-on features are switched off. Everything is still safe and will return once the subscription is renewed."
          : "Your school hasn't added this feature. Nothing has been deleted; if it is added later, everything will be here."}
      </p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
        {isAdmin && (
          <Link href="/dashboard/admin/license" className="underline">
            View license
          </Link>
        )}
      </div>
    </div>
  );
}
