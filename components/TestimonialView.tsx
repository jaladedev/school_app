import React from "react";
import { PrintButton } from "@/components/PrintButton";

export function TestimonialView({
  schoolName,
  schoolMotto,
  schoolAddress,
  logoUrl,
  studentName,
  admissionNo,
  admissionAcademicYear,
  leavingAcademicYear,
  finalClassLabel,
  conductRemark,
  issuedAt,
}: {
  schoolName: string;
  schoolMotto: string | null;
  schoolAddress: string | null;
  logoUrl: string | null;
  studentName: string;
  admissionNo: string | null;
  admissionAcademicYear: string;
  leavingAcademicYear: string;
  finalClassLabel: string | null;
  conductRemark: string;
  issuedAt: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-soft">Testimonial</p>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-rule bg-white p-10 print:border-0 print:p-0 print:shadow-none">
        <div className="mb-8 flex items-center gap-3 border-b-2 border-ink pb-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : null}
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{schoolName}</h1>
            {schoolMotto && <p className="text-xs italic text-ink-soft">{schoolMotto}</p>}
            {schoolAddress && <p className="text-xs text-ink-soft">{schoolAddress}</p>}
          </div>
        </div>

        <h2 className="mb-6 text-center text-lg font-semibold uppercase tracking-wide text-ink">
          Testimonial
        </h2>

        <p className="mb-6 text-right text-sm text-ink-soft">
          {new Date(issuedAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <p className="mb-4 text-sm leading-relaxed text-ink">
          This is to certify that <span className="font-semibold">{studentName}</span>
          {admissionNo ? ` (Admission No. ${admissionNo})` : ""} was a student of {schoolName} from
          the {admissionAcademicYear} to the {leavingAcademicYear} academic session
          {finalClassLabel ? `, and left in ${finalClassLabel}` : ""}.
        </p>

        <p className="mb-8 text-sm leading-relaxed text-ink">{conductRemark}</p>

        <p className="mb-12 text-sm leading-relaxed text-ink">
          We wish {studentName.split(" ")[0]} the very best in their future endeavours.
        </p>

        <div className="flex justify-end">
          <div className="text-center">
            <div className="mb-1 h-10 w-48 border-b border-ink" />
            <p className="text-xs text-ink-soft">Principal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
