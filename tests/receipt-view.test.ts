import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptView } from "@/components/ReceiptView";

describe("ReceiptView", () => {
  it("does not render the legacy PDF download button", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptView, {
        schoolName: "Example School",
        schoolMotto: "Learning is life",
        receiptNo: "RCPT-001",
        studentName: "Ada Lovelace",
        admissionNo: "ADM-001",
        feeTitle: "School Fees",
        term: 1,
        academicYear: "2024/2025",
        amountKobo: 500000,
        method: "cash" as const,
        reference: null,
        paidAt: "2024-09-06T10:00:00.000Z",
        recordedBy: "Admin User",
      }),
    );

    expect(html).not.toContain("Download PDF");
  });
});
