"use client";

import React from "react";

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
  method: "cash" | "bank_transfer" | "card" | "other";
  reference: string | null;
  paidAt: string;
  recordedBy: string | null;
};

export function ReceiptPdfButton(_props: ReceiptPdfButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-rule bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
    >
      Print / Save PDF
    </button>
  );
}
