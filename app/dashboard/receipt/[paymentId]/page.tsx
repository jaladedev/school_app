import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { getLinkedChildren } from "@/lib/parent";
import { ReceiptView } from "@/components/ReceiptView";

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const resolvedParams = await params;

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto")
    .eq("id", 1)
    .single();

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "*, invoices(term, academic_year, fee_structures(title)), student_profiles(id, admission_no, profiles(full_name)), profiles(full_name)"
    )
    .eq("id", resolvedParams.paymentId)
    .single();

  if (!payment) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Receipt not found, or you don&apos;t have access to it.</p>
      </div>
    );
  }

  // A payment receipt carries a family's financial + admission details, so
  // access is scoped the same way every other fees page is scoped: admin
  // and bursar staff see everything, a parent only their own linked
  // children's payments, and a student only their own -- never any
  // logged-in user who happens to have (or guesses) the payment's UUID.
  let authorized = false;
  if (profile.role === "admin") {
    authorized = true;
  } else if (profile.role === "teacher") {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .single();
    authorized = teacher?.staff_role === "bursar";
  } else if (profile.role === "student") {
    authorized = payment.student_profiles?.id === profile.id;
  } else if (profile.role === "parent") {
    const children = await getLinkedChildren();
    authorized = children.some((c) => c.id === payment.student_profiles?.id);
  }

  if (!authorized) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Receipt not found, or you don&apos;t have access to it.</p>
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
