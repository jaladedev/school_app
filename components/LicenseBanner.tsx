import Link from "next/link";
import type { LicenseBanner as Banner } from "@/lib/license";

const TONE_CLASSES: Record<Banner["tone"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
};

/** `manageHref` adds a "View license" link (shown to the school admin). */
export function LicenseBanner({
  banner,
  manageHref,
}: {
  banner: Banner | null;
  manageHref?: string;
}) {
  if (!banner) return null;
  return (
    <div
      role={banner.tone === "danger" ? "alert" : "status"}
      className={`mb-4 rounded-md border px-4 py-3 text-sm ${TONE_CLASSES[banner.tone]}`}
    >
      {banner.message}
      {manageHref && (
        <>
          {" "}
          <Link href={manageHref} className="font-medium underline">
            View license
          </Link>
        </>
      )}
    </div>
  );
}
