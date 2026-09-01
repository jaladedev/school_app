import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";
import { BarList } from "@/components/BarList";
import {
  getEnrollmentTrend,
  getFeeCollectionTrend,
  getAverageGradesBySubject,
  getAttendanceTrend,
  getTeacherWorkload,
  getLibraryOverdueTrend,
  getDefaulterTrend,
} from "@/lib/analytics";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-rule bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-ink-soft">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term, current_term_start_date")
    .eq("id", 1)
    .single();

  const academicYear = settings?.current_academic_year ?? "";
  const term = settings?.current_term ?? 1;

  const [
    enrollmentTrend,
    feeCollectionTrend,
    subjectGrades,
    attendanceTrend,
    teacherWorkload,
    libraryOverdueTrend,
    defaulterTrend,
  ] = await Promise.all([
    getEnrollmentTrend(supabase),
    getFeeCollectionTrend(supabase),
    getAverageGradesBySubject(supabase, academicYear, term),
    getAttendanceTrend(supabase, settings?.current_term_start_date ?? null),
    getTeacherWorkload(supabase, academicYear, term),
    getLibraryOverdueTrend(supabase),
    getDefaulterTrend(supabase),
  ]);

  const currentFeePoint = feeCollectionTrend.find(
    (p) => p.label === `${academicYear} · Term ${term}`
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Analytics</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Aggregate views across enrollment, fees, grades, attendance, and staffing.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Enrollment by term" subtitle="Total enrollment records per academic term">
          {enrollmentTrend.length ? (
            <BarList
              items={enrollmentTrend.map((p) => ({
                label: p.label,
                value: p.count,
                displayValue: `${p.count}`,
              }))}
            />
          ) : (
            <EmptyState message="No enrollment data yet." />
          )}
        </Card>

        <Card
          title="Fee collection"
          subtitle={
            currentFeePoint
              ? `Current term: ${currentFeePoint.unpaidCount} of ${currentFeePoint.invoiceCount} invoices still owing`
              : "No invoices for the current term yet"
          }
        >
          {feeCollectionTrend.length ? (
            <BarList
              colorClassName="bg-marigold"
              items={feeCollectionTrend.map((p) => ({
                label: p.label,
                value: p.billedKobo ? p.collectedKobo / p.billedKobo : 0,
                displayValue: `${formatKobo(p.collectedKobo)} / ${formatKobo(p.billedKobo)}`,
              }))}
            />
          ) : (
            <EmptyState message="No invoices recorded yet." />
          )}
        </Card>

        <Card
          title="Average grades by subject and class"
          subtitle={`Approved grades, ${academicYear} · Term ${term}`}
        >
          {subjectGrades.length ? (
            <BarList
              items={subjectGrades.map((s) => ({
                label: `${s.subjectName} · ${s.className}`,
                value: s.averagePercent,
                displayValue: `${s.averagePercent}% (${s.gradeCount} grades)`,
              }))}
            />
          ) : (
            <EmptyState message="No approved grades for the current term yet." />
          )}
        </Card>

        <Card
          title="Attendance rate"
          subtitle={
            settings?.current_term_start_date
              ? "Weekly present-or-late rate, since this term started"
              : "Weekly present-or-late rate, last 8 weeks (set a term start date in Settings to track from term start instead)"
          }
        >
          {attendanceTrend.length ? (
            <BarList
              colorClassName="bg-clay"
              items={attendanceTrend.map((w) => ({
                label: w.label,
                value: w.ratePercent,
                displayValue: `${w.ratePercent}% (${w.totalMarked} marked)`,
              }))}
            />
          ) : (
            <EmptyState message="No attendance recorded in the last 8 weeks." />
          )}
        </Card>

        <Card
          title="Teacher workload"
          subtitle={`Scheduled periods per week, ${academicYear} · Term ${term}`}
        >
          {teacherWorkload.length ? (
            <BarList
              items={teacherWorkload.map((t) => ({
                label: t.teacherName,
                value: t.periodsPerWeek,
                displayValue: `${t.periodsPerWeek} periods/week`,
              }))}
            />
          ) : (
            <EmptyState message="No timetable entries for the current term yet." />
          )}
        </Card>

        <Card
          title="Library overdue rate"
          subtitle={
            libraryOverdueTrend.length
              ? `Today: ${libraryOverdueTrend[libraryOverdueTrend.length - 1].overdueCount} of ${libraryOverdueTrend[libraryOverdueTrend.length - 1].activeCount} active loans overdue — daily, last ${libraryOverdueTrend.length} days`
              : "Daily overdue rate, last 30 days"
          }
        >
          {libraryOverdueTrend.some((p) => p.activeCount > 0) ? (
            <BarList
              colorClassName="bg-clay"
              items={libraryOverdueTrend.map((p) => ({
                label: p.label,
                value: p.ratePercent,
                displayValue: `${p.ratePercent}% (${p.overdueCount}/${p.activeCount})`,
              }))}
            />
          ) : (
            <EmptyState message="No library loans in the last 30 days." />
          )}
        </Card>

        <Card
          title="Defaulter trend"
          subtitle="Distinct students still owing something, per term (not invoice count)"
        >
          {defaulterTrend.length ? (
            <BarList
              colorClassName="bg-marigold"
              items={defaulterTrend.map((p) => ({
                label: p.label,
                value: p.defaulterRatePercent,
                displayValue: `${p.defaulterCount} of ${p.billedStudentCount} students (${p.defaulterRatePercent}%)`,
              }))}
            />
          ) : (
            <EmptyState message="No invoices recorded yet." />
          )}
        </Card>
      </div>
    </div>
  );
}
