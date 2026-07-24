import { getReportCardData } from "@/lib/report-card";
import { ReportCardView } from "@/components/ReportCardView";
import { TermYearSelector } from "@/components/TermYearSelector";
import { RemarkForm } from "@/components/RemarkForm";

function defaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export default async function AdminStudentReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string; year?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const resolvedParams = await params;

  const term = Number(resolvedSearchParams.term ?? 1);
  const academicYear = resolvedSearchParams.year ?? defaultAcademicYear();

  const data = await getReportCardData(resolvedParams.studentId, term, academicYear);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Report card</h1>
      <TermYearSelector currentTerm={term} currentYear={academicYear} />

      {data ? (
        <ReportCardView
          data={data}
          editRemarkSlot={
            <RemarkForm
              studentId={resolvedParams.studentId}
              term={term}
              academicYear={academicYear}
              initialClassTeacherRemark={data.remark?.classTeacherRemark ?? null}
              initialAdminRemark={data.remark?.adminRemark ?? null}
            />
          }
        />
      ) : (
        <p className="text-sm text-ink-soft">
          This student isn&apos;t assigned to a class yet, so no report card can be generated.
        </p>
      )}
    </div>
  );
}
