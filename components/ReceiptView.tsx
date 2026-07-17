import { PrintButton } from "@/components/PrintButton";
import { formatKobo, type PaymentMethod } from "@/types/database";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card (Online)",
  other: "Other",
};

export function ReceiptView({
  schoolName,
  schoolMotto,
  receiptNo,
  studentName,
  admissionNo,
  feeTitle,
  term,
  academicYear,
  amountKobo,
  method,
  reference,
  paidAt,
  recordedBy,
}: {
  schoolName: string;
  schoolMotto: string | null;
  receiptNo: string;
  studentName: string;
  admissionNo: string | null;
  feeTitle: string;
  term: number;
  academicYear: string;
  amountKobo: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  recordedBy: string | null;
}) {
  return (
    <div className="max-w-lg">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-soft">Payment Receipt</p>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-rule bg-white p-8 print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 border-b-2 border-ink pb-4 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">{schoolName}</h1>
          {schoolMotto && <p className="mt-1 text-xs italic text-ink-soft">{schoolMotto}</p>}
          <p className="mt-1 text-sm uppercase tracking-wide text-ink-soft">
            Official Payment Receipt
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Receipt No.</span>
          <span className="font-mono font-medium text-ink">{receiptNo}</span>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-ink-soft">Student</span>
          <span className="text-right font-medium text-ink">{studentName}</span>
          {admissionNo && (
            <>
              <span className="text-ink-soft">Admission No.</span>
              <span className="text-right text-ink">{admissionNo}</span>
            </>
          )}
          <span className="text-ink-soft">Fee</span>
          <span className="text-right text-ink">{feeTitle}</span>
          <span className="text-ink-soft">Term / Session</span>
          <span className="text-right text-ink">
            Term {term}, {academicYear}
          </span>
          <span className="text-ink-soft">Payment Method</span>
          <span className="text-right text-ink">{METHOD_LABELS[method]}</span>
          {reference && (
            <>
              <span className="text-ink-soft">Reference</span>
              <span className="text-right font-mono text-xs text-ink">{reference}</span>
            </>
          )}
          <span className="text-ink-soft">Date</span>
          <span className="text-right text-ink">
            {new Date(paidAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="mb-6 rounded-lg bg-leaf-soft p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-leaf">Amount Paid</p>
          <p className="font-display text-3xl font-semibold text-leaf">{formatKobo(amountKobo)}</p>
        </div>

        <div className="border-t border-rule pt-4 text-center text-xs text-ink-soft">
          {recordedBy ? `Recorded by ${recordedBy}` : "Verified automatically via online payment"}
        </div>
      </div>
    </div>
  );
}
