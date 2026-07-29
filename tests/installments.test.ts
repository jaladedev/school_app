import { describe, expect, it } from "vitest";
import { allocateInstallmentProgress, type InstallmentRow } from "@/lib/installments";

const installments: InstallmentRow[] = [
  { id: "a", sequence_order: 1, due_date: "2026-01-15", amount_kobo: 10_000 },
  { id: "b", sequence_order: 2, due_date: "2026-02-15", amount_kobo: 10_000 },
  { id: "c", sequence_order: 3, due_date: "2026-03-15", amount_kobo: 10_000 },
];

describe("allocateInstallmentProgress", () => {
  it("allocates nothing paid when the invoice has no payments yet", () => {
    const progress = allocateInstallmentProgress(installments, 0, "2026-01-01");
    expect(progress.every((p) => p.paidKobo === 0)).toBe(true);
    expect(progress.every((p) => !p.isPaid)).toBe(true);
  });

  it("fills earlier installments first, leaving later ones untouched", () => {
    const progress = allocateInstallmentProgress(installments, 15_000, "2026-01-01");
    expect(progress[0]).toMatchObject({ paidKobo: 10_000, isPaid: true, remainingKobo: 0 });
    expect(progress[1]).toMatchObject({ paidKobo: 5_000, isPaid: false, remainingKobo: 5_000 });
    expect(progress[2]).toMatchObject({ paidKobo: 0, isPaid: false, remainingKobo: 10_000 });
  });

  it("marks every installment paid once the total covers the whole schedule", () => {
    const progress = allocateInstallmentProgress(installments, 30_000, "2026-01-01");
    expect(progress.every((p) => p.isPaid)).toBe(true);
  });

  it("handles an overpayment without allocating more than each installment's amount", () => {
    const progress = allocateInstallmentProgress(installments, 999_999, "2026-01-01");
    expect(progress.every((p) => p.paidKobo === p.amountKobo)).toBe(true);
  });

  it("flags an unpaid installment as overdue once its due date has passed", () => {
    const progress = allocateInstallmentProgress(installments, 0, "2026-02-01");
    expect(progress[0].isOverdue).toBe(true); // due 2026-01-15, unpaid
    expect(progress[1].isOverdue).toBe(false); // due 2026-02-15, not yet due
  });

  it("never flags a fully-paid installment as overdue, even past its due date", () => {
    const progress = allocateInstallmentProgress(installments, 10_000, "2026-06-01");
    expect(progress[0]).toMatchObject({ isPaid: true, isOverdue: false });
    expect(progress[1].isOverdue).toBe(true); // still unpaid, well past due
  });

  it("sorts by sequence_order regardless of input array order", () => {
    const shuffled = [installments[2], installments[0], installments[1]];
    const progress = allocateInstallmentProgress(shuffled, 10_000, "2026-01-01");
    expect(progress.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
