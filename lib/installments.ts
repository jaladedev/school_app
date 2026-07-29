/**
 * How much of an invoice's total amount_paid_kobo "belongs to" each
 * installment. This is computed on read, not stored -- an installment
 * plan is a due-dated schedule laid on top of the existing
 * invoice/payment ledger, not a second ledger, so there's nothing here
 * that could ever drift out of sync with the real payment total. A
 * payment is allocated to the earliest unpaid installment first (the
 * natural "pay down what's oldest/due-soonest" order), same idea as how
 * a bank statement shows a payment clearing your oldest outstanding
 * balance first.
 */

export type InstallmentRow = {
  id: string;
  sequence_order: number;
  due_date: string;
  amount_kobo: number;
};

export type InstallmentProgress = {
  id: string;
  sequenceOrder: number;
  dueDate: string;
  amountKobo: number;
  paidKobo: number;
  remainingKobo: number;
  isPaid: boolean;
  /** Only meaningful when there's still a balance on this installment. */
  isOverdue: boolean;
};

export function allocateInstallmentProgress(
  installments: InstallmentRow[],
  totalPaidKobo: number,
  today: string = new Date().toISOString().slice(0, 10)
): InstallmentProgress[] {
  const sorted = [...installments].sort((a, b) => a.sequence_order - b.sequence_order);
  let remainingToAllocate = Math.max(0, totalPaidKobo);

  return sorted.map((inst) => {
    const paidKobo = Math.min(inst.amount_kobo, remainingToAllocate);
    remainingToAllocate -= paidKobo;
    const remainingKobo = inst.amount_kobo - paidKobo;

    return {
      id: inst.id,
      sequenceOrder: inst.sequence_order,
      dueDate: inst.due_date,
      amountKobo: inst.amount_kobo,
      paidKobo,
      remainingKobo,
      isPaid: remainingKobo <= 0,
      isOverdue: remainingKobo > 0 && inst.due_date < today,
    };
  });
}
