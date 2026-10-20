import { FEATURE_LABELS, LICENSE_FEATURES } from "@/lib/features";
import { STATUS_LABELS, daysUntil, licenseHasFeature, studentCapBanner } from "@/lib/license";
import { getLicenseSummary } from "@/lib/licenseInfo";
import { LicenseBanner } from "@/components/LicenseBanner";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AdminLicensePage() {
  const summary = await getLicenseSummary();

  if (!summary) {
    return (
      <div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">License</h1>
        <p className="text-sm text-clay">
          The license details couldn&rsquo;t be loaded right now. Please try again shortly.
        </p>
      </div>
    );
  }

  const info = {
    status: summary.status,
    isTrial: summary.isTrial,
    validUntil: summary.validUntil,
    graceUntil: summary.graceUntil,
    features: summary.status === "none" ? null : summary.features,
  };
  const supportEmail = process.env.LICENSE_SUPPORT_EMAIL;
  const capWarning = studentCapBanner(summary.studentCount, summary.studentCap);
  const daysLeft = daysUntil(summary.validUntil);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">License</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Your school&rsquo;s subscription, included students and enabled features. This page is
        read-only.
      </p>

      <LicenseBanner banner={capWarning} />

      {summary.status === "none" ? (
        <p className="mb-6 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm">
          This school has no license on file, so every feature is available and nothing is
          restricted.
        </p>
      ) : (
        <dl className="mb-8 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-soft">Status</dt>
          <dd className="font-medium">
            {STATUS_LABELS[summary.status]}
            {summary.isTrial ? " (free trial)" : ""}
          </dd>
          <dt className="text-ink-soft">Session</dt>
          <dd>{summary.session ?? "—"}</dd>
          <dt className="text-ink-soft">Valid until</dt>
          <dd>
            {formatDate(summary.validUntil)}
            {summary.status === "active" && daysLeft > 0 ? ` (${daysLeft} days left)` : ""}
          </dd>
          <dt className="text-ink-soft">Grace period ends</dt>
          <dd>{formatDate(summary.graceUntil)}</dd>
          <dt className="text-ink-soft">Active students</dt>
          <dd>
            {summary.studentCount}
            {summary.studentCap ? ` of ${summary.studentCap} included` : ""}
          </dd>
        </dl>
      )}

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Features</h2>
      <ul className="mb-8 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm">
        {LICENSE_FEATURES.map((feature) => {
          const on = licenseHasFeature(info, feature);
          const switchedOff = summary.status === "expired" && summary.features.includes(feature);
          return (
            <li key={feature} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <div className="font-medium">{FEATURE_LABELS[feature].label}</div>
                <div className="text-ink-soft">{FEATURE_LABELS[feature].description}</div>
              </div>
              <span className={on ? "text-leaf" : "text-ink-soft"}>
                {on ? "Included" : switchedOff ? "Switched off (lapsed)" : "Not included"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mb-6 text-sm text-ink-soft">
        Core features (students, classes, timetable, attendance, grades, report cards, homework,
        quizzes, fees and payments, announcements, ID cards and exports) are always included.
      </p>

      {supportEmail ? (
        <a
          href={`mailto:${supportEmail}?subject=${encodeURIComponent("License change request")}`}
          className="inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Request a change
        </a>
      ) : null}
    </div>
  );
}
