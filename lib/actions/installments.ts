"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCanManageFees } from "@/lib/actions/fees";
import { writeAuditLog } from "@/lib/audit";

export type InstallmentInput = {
  dueDate: string;
  amountKobo: number;
};

const PATHS_TO_REVALIDATE = [
  "/dashboard/admin/fees/invoices",
  "/dashboard/student/fees",
  "/dashboard/parent/fees",
];

/**
 * Creates a plan, or wholesale replaces an existing one -- there's no
 * incremental "edit installment #2" operation. A schedule is small (a
 * handful of rows) and changing one due date or amount usually means
 * rethinking the whole plan anyway, so replace-the-set is simpler and
 * safer than reconciling a partial edit against whatever's already
 * been (or hasn't been) paid against the old rows.
 */
export async function createOrReplaceInstallmentPlan(
  invoiceId: string,
  installments: InstallmentInput[]
) {
  const { id: actorId } = await assertCanManageFees(
    "Only an admin or the bursar can manage installment plans."
  );
  const admin = createAdminClient();

  if (installments.length < 2) {
    throw new Error(
      "An installment plan needs at least 2 installments -- for a single due date, just use the invoice's own due date instead."
    );
  }

  for (const inst of installments) {
    if (!inst.dueDate) throw new Error("Every installment needs a due date.");
    if (!Number.isInteger(inst.amountKobo) || inst.amountKobo <= 0) {
      throw new Error("Every installment amount must be a positive whole number of kobo.");
    }
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, voided_at")
    .eq("id", invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.voided_at) throw new Error("This invoice has been voided.");

  const netPayableKobo = invoice.total_amount_kobo - invoice.discount_kobo;
  const scheduleTotalKobo = installments.reduce((sum, i) => sum + i.amountKobo, 0);

  if (scheduleTotalKobo !== netPayableKobo) {
    throw new Error(
      `The installments add up to ${(scheduleTotalKobo / 100).toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
      })}, but the invoice's net payable amount (after any discount) is ${(
        netPayableKobo / 100
      ).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}. They must match exactly.`
    );
  }

  // Sequence order comes from the due-date sort, not submission order --
  // "installment 1" should always mean "the one due soonest", regardless
  // of what order rows were added in the form.
  const sorted = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const { error: deleteError } = await admin
    .from("invoice_installments")
    .delete()
    .eq("invoice_id", invoiceId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await admin.from("invoice_installments").insert(
    sorted.map((inst, index) => ({
      invoice_id: invoiceId,
      sequence_order: index + 1,
      due_date: inst.dueDate,
      amount_kobo: inst.amountKobo,
      created_by: actorId,
    }))
  );
  if (insertError) throw new Error(insertError.message);

  await writeAuditLog({
    entityType: "invoice",
    entityId: invoiceId,
    action: "installment_plan_created",
    actorId,
    metadata: {
      installment_count: sorted.length,
      total_kobo: scheduleTotalKobo,
      due_dates: sorted.map((i) => i.dueDate),
    },
  });

  for (const path of PATHS_TO_REVALIDATE) revalidatePath(path);
}

export async function deleteInstallmentPlan(invoiceId: string) {
  const { id: actorId } = await assertCanManageFees(
    "Only an admin or the bursar can manage installment plans."
  );
  const admin = createAdminClient();

  const { error } = await admin.from("invoice_installments").delete().eq("invoice_id", invoiceId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "invoice",
    entityId: invoiceId,
    action: "installment_plan_removed",
    actorId,
    metadata: {},
  });

  for (const path of PATHS_TO_REVALIDATE) revalidatePath(path);
}
