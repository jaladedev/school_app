import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { getReportCardData } from "@/lib/report-card";
import { ReportCardView } from "@/components/ReportCardView";
import { TermYearSelector } from "@/components/TermYearSelector";

function defaultAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export default async function ParentReportCardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string; year?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(resolvedSearchParams.child);

  if (!selected) {
    return <p className="text-sm text-ink-soft">No children linked to your account.</p>;
  }

  const term = Number(resolvedSearchParams.term ?? 1);
  const academicYear = resolvedSearchParams.year ?? defaultAcademicYear();

  const data = await getReportCardData(selected.id, term, academicYear);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Report card</h1>
      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />
      <TermYearSelector currentTerm={term} currentYear={academicYear} />

      {data ? (
        <ReportCardView data={data} />
      ) : (
        <p className="text-sm text-ink-soft">Report card is not available yet for this term.</p>
      )}
    </div>
  );
}
