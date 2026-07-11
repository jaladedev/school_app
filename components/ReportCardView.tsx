import { formatLevel } from "@/types/database";
import type { ReportCardData } from "@/lib/report-card";
import { PrintButton } from "@/components/PrintButton";

export function ReportCardView({
  data,
  schoolName = "School Name",
  editRemarkSlot,
}: {
  data: ReportCardData;
  schoolName?: string;
  editRemarkSlot?: React.ReactNode;
}) {
  const attendancePercent =
    data.attendance.total > 0
      ? Math.round((data.attendance.present / data.attendance.total) * 1000) / 10
      : null;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-soft">
          Term {data.term} · {data.academicYear}
        </p>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-rule bg-white p-8 print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="mb-6 border-b-2 border-ink pb-4 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">{schoolName}</h1>
          <p className="mt-1 text-sm uppercase tracking-wide text-ink-soft">
            Termly Report Card
          </p>
        </div>

        {/* Student info */}
        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <span className="text-ink-soft">Name: </span>
            <span className="font-medium text-ink">{data.student.fullName}</span>
          </div>
          <div>
            <span className="text-ink-soft">Class: </span>
            <span className="font-medium text-ink">{data.className}</span>
          </div>
          <div>
            <span className="text-ink-soft">Admission No: </span>
            <span className="font-medium text-ink">{data.student.admissionNo ?? "—"}</span>
          </div>
          <div>
            <span className="text-ink-soft">Term / Session: </span>
            <span className="font-medium text-ink">
              Term {data.term}, {data.academicYear}
            </span>
          </div>
        </div>

        {/* Subjects table */}
        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="py-2 pr-2">Subject</th>
              <th className="py-2 pr-2 text-right">Score (%)</th>
              <th className="py-2 pr-2 text-right">Position</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((s) => (
              <tr key={s.subjectId} className="border-b border-rule">
                <td className="py-2 pr-2 text-ink">{s.subjectName}</td>
                <td className="py-2 pr-2 text-right text-ink">
                  {s.scorePercent !== null ? `${s.scorePercent}%` : "—"}
                </td>
                <td className="py-2 pr-2 text-right text-ink-soft">
                  {s.position ? `${s.position} of ${s.classSize}` : "—"}
                </td>
              </tr>
            ))}
            {!data.subjects.length && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-ink-soft">
                  No grades recorded for this term yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Overall + attendance summary */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-rule bg-paper p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">
              Overall Average
            </p>
            <p className="font-display text-xl font-semibold text-ink">
              {data.overall.averagePercent !== null ? `${data.overall.averagePercent}%` : "—"}
            </p>
            <p className="text-sm text-ink-soft">
              {data.overall.position
                ? `Position: ${data.overall.position} of ${data.overall.classSize}`
                : "Position: —"}
            </p>
          </div>
          <div className="rounded-lg border border-rule bg-paper p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Attendance</p>
            <p className="font-display text-xl font-semibold text-ink">
              {attendancePercent !== null ? `${attendancePercent}%` : "—"}
            </p>
            <p className="text-sm text-ink-soft">
              {data.attendance.present} present · {data.attendance.absent} absent ·{" "}
              {data.attendance.late} late · {data.attendance.excused} excused
            </p>
          </div>
        </div>

        {/* Remarks */}
        <div className="space-y-3 border-t border-rule pt-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Class Teacher's Remark
            </p>
            <p className="text-sm text-ink">
              {data.remark?.classTeacherRemark || "No remark yet."}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Head Teacher's / Admin Remark
            </p>
            <p className="text-sm text-ink">{data.remark?.adminRemark || "No remark yet."}</p>
          </div>
        </div>
      </div>

      {editRemarkSlot && <div className="print:hidden">{editRemarkSlot}</div>}
    </div>
  );
}