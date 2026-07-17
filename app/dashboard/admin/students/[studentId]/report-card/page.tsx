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
  params: { studentId: string };
  searchParams: { term?: string; year?: string };
}) {
  const term = Number(searchParams.term ?? 1);
  const academicYear = searchParams.year ?? defaultAcademicYear();

  const data = await getReportCardData(params.studentId, term, academicYear);

  return (
    <div>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Report card
      </h1>
      <TermYearSelector currentTerm={term} currentYear={academicYear} />

      {data ? (
        <ReportCardView
          data={data}
          editRemarkSlot={
            <RemarkForm
              studentId={params.studentId}
              term={term}
              academicYear={academicYear}
              initialClassTeacherRemark={data.remark?.classTeacherRemark ?? null}
              initialAdminRemark={data.remark?.adminRemark ?? null}
            />
          }
        />
      ) : (
        <p className="text-sm text-ink-soft">
          This student isn't assigned to a class yet, so no report card can be generated.
        </p>
      )}
    </div>
  );
}