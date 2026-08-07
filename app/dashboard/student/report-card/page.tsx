import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { getReportCardData, isFutureTerm } from "@/lib/report-card";
import { ReportCardView } from "@/components/ReportCardView";
import { TermYearSelector } from "@/components/TermYearSelector";
import { redirect } from "next/navigation";

function defaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export default async function StudentReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; year?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const term = Number(resolvedSearchParams.term ?? 1);
  const academicYear = resolvedSearchParams.year ?? defaultAcademicYear();

  const supabase = createClient();
  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_term, current_academic_year")
    .eq("id", 1)
    .single();

  // Block future terms server-side — the TermYearSelector limits the UI
  // but a student can still hand-edit the URL, so this must be enforced here.
  const isFuture =
    !!settings &&
    isFutureTerm(term, academicYear, settings.current_term, settings.current_academic_year);

  // getReportCardData uses admin client for grades/attendance (bypasses RLS)
  // but the remark row is fetched via the session client, which only returns
  // it when moderation_status = 'approved' (enforced by the RLS policy on
  // report_card_remarks). So data.remark will be null for any unapproved card
  // even if grades exist — data itself may still be non-null (grades present).
  const data = isFuture ? null : await getReportCardData(profile.id, term, academicYear);

  const isApproved = data?.remark?.moderationStatus === "approved";

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My report card</h1>
      <TermYearSelector currentTerm={term} currentYear={academicYear} />

      {isFuture ? (
        <p className="text-sm text-ink-soft">
          This term hasn&apos;t started yet — check back once it&apos;s underway.
        </p>
      ) : data && isApproved ? (
        <ReportCardView data={data} />
      ) : data ? (
        // Grades exist but the admin hasn't released the card yet
        <p className="text-sm text-ink-soft">
          Your report card for this term is still being reviewed and hasn&apos;t been released yet —
          check back soon.
        </p>
      ) : (
        // No grades at all, or not assigned to a class
        <p className="text-sm text-ink-soft">
          Report card isn&apos;t available yet — you may not be assigned to a class.
        </p>
      )}
    </div>
  );
}
