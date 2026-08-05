import { allocateInstallmentProgress, type InstallmentRow } from "@/lib/installments";
import { formatKobo } from "@/types/database";

export function InstallmentScheduleView({
  installments,
  amountPaidKobo,
}: {
  installments: InstallmentRow[];
  amountPaidKobo: number;
}) {
  if (!installments.length) return null;

  const progress = allocateInstallmentProgress(installments, amountPaidKobo);

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-medium text-ink-soft">Installment plan</p>
      {progress.map((inst) => (
        <div
          key={inst.id}
          className="flex items-center justify-between rounded-lg bg-paper px-3 py-1.5 text-xs"
        >
          <span className="text-ink">
            {new Date(inst.dueDate).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="text-ink">{formatKobo(inst.amountKobo)}</span>
          {inst.isPaid ? (
            <span className="rounded-full bg-leaf-soft px-2 py-0.5 font-medium text-leaf">
              Paid
            </span>
          ) : inst.isOverdue ? (
            <span className="rounded-full bg-clay/20 px-2 py-0.5 font-medium text-clay">
              Overdue · {formatKobo(inst.remainingKobo)} due
            </span>
          ) : (
            <span className="rounded-full bg-marigold/20 px-2 py-0.5 font-medium text-marigold-text">
              {formatKobo(inst.remainingKobo)} due
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
