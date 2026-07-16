import { createClient } from "@/lib/supabase/server";
import { ReceiptView } from "@/components/ReceiptView";

export default async function ReceiptPage({
  params,
}: {
  params: { paymentId: string };
}) {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto")
    .eq("id", 1)
    .single();

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "*, invoices(term, academic_year, fee_structures(title)), student_profiles(admission_no, profiles(full_name)), profiles(full_name)"
    )
    .eq("id", params.paymentId)
    .single();

  if (!payment) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">
          Receipt not found, or you don't have access to it.
        </p>
      </div>
    );
  }

  const invoice = payment.invoices;
  const studentProfile = payment.student_profiles;
  const verifier = payment.profiles;

  return (
    <ReceiptView
      schoolName={settings?.name ?? "School Name"}
      schoolMotto={settings?.motto ?? null}
      receiptNo={payment.id.slice(0, 8).toUpperCase()}
      studentName={studentProfile?.profiles?.full_name ?? "Unknown"}
      admissionNo={studentProfile?.admission_no ?? null}
      feeTitle={invoice?.fee_structures?.title ?? "Fee Payment"}
      term={invoice?.term ?? 0}
      academicYear={invoice?.academic_year ?? ""}
      amountKobo={payment.amount_kobo}
      method={payment.method}
      reference={payment.reference}
      paidAt={payment.paid_at}
      recordedBy={verifier?.full_name ?? null}
    />
  );
}