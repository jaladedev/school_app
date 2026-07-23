"use client";

import { jsPDF } from "jspdf";
import { formatKobo, type PaymentMethod } from "@/types/database";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card (Online)",
  other: "Other",
};

type ReceiptPdfButtonProps = {
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
};

export function ReceiptPdfButton(props: ReceiptPdfButtonProps) {
  function downloadPdf() {
    const pdf = new jsPDF({ unit: "mm", format: "a5" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 20;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(props.schoolName, pageWidth / 2, y, { align: "center" });
    y += 7;

    if (props.schoolMotto) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      pdf.text(props.schoolMotto, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("OFFICIAL PAYMENT RECEIPT", pageWidth / 2, y, { align: "center" });
    y += 8;
    pdf.line(15, y, pageWidth - 15, y);
    y += 10;

    const rows = [
      ["Receipt No.", props.receiptNo],
      ["Student", props.studentName],
      ...(props.admissionNo ? [["Admission No.", props.admissionNo]] : []),
      ["Fee", props.feeTitle],
      ["Term / Session", `Term ${props.term}, ${props.academicYear}`],
      ["Payment Method", METHOD_LABELS[props.method]],
      ...(props.reference ? [["Reference", props.reference]] : []),
      [
        "Date",
        new Date(props.paidAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      ],
    ];

    pdf.setFontSize(10);
    for (const [label, value] of rows) {
      pdf.setFont("helvetica", "normal");
      pdf.text(label, 18, y);
      pdf.setFont("helvetica", "bold");
      const valueLines = pdf.splitTextToSize(value, 82);
      pdf.text(valueLines, pageWidth - 18, y, { align: "right" });
      y += Math.max(7, valueLines.length * 5 + 2);
    }

    y += 3;
    pdf.setFillColor(229, 245, 232);
    pdf.roundedRect(18, y, pageWidth - 36, 25, 3, 3, "F");
    pdf.setTextColor(36, 110, 72);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("AMOUNT PAID", pageWidth / 2, y + 8, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(formatKobo(props.amountKobo), pageWidth / 2, y + 18, { align: "center" });

    pdf.setTextColor(80, 80, 80);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const footer = props.recordedBy
      ? `Recorded by ${props.recordedBy}`
      : "Verified automatically via online payment";
    pdf.text(footer, pageWidth / 2, y + 36, { align: "center" });

    pdf.save(`receipt-${props.receiptNo}.pdf`);
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      className="rounded-lg border border-rule bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
    >
      Download PDF
    </button>
  );
}
