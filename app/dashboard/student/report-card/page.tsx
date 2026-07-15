import { getCurrentProfile } from "@/lib/supabase/server";
import { getReportCardData } from "@/lib/report-card";
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
  searchParams: { term?: string; year?: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const term = Number(searchParams.term ?? 1);
  const academicYear = searchParams.year ?? defaultAcademicYear();

  const data = await getReportCardData(profile.id, term, academicYear);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        My report card
      </h1>
      <TermYearSelector currentTerm={term} currentYear={academicYear} />

      {data ? (
        <ReportCardView data={data} />
      ) : (
        <p className="text-sm text-ink-soft">
          Report card isn't available yet — you may not be assigned to a class.
        </p>
      )}
    </div>
  );
}