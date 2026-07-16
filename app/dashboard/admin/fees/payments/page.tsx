import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, type PaymentMethod } from "@/types/database";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card (Online)",
  other: "Other",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: payments, count } = await supabase
    .from("payments")
    .select(
      "*, student_profiles(profiles(full_name)), invoices(fee_structures(title))",
      { count: "exact" }
    )
    .order("paid_at", { ascending: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Payment History
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {count ?? 0} payments recorded · page {page} of {totalPages}
      </p>
      <div className="space-y-2">
        {payments?.map((p) => {
          const studentProfile = p.student_profiles;
          const invoice = p.invoices;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {studentProfile?.profiles?.full_name ?? "Unknown"}
                </p>
                <p className="text-xs text-ink-soft">
                  {invoice?.fee_structures?.title} · {METHOD_LABELS[p.method as PaymentMethod]} ·{" "}
                  {new Date(p.paid_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-lg font-semibold text-leaf">
                  {formatKobo(p.amount_kobo)}
                </span>
                <Link
                  href={`/dashboard/receipt/${p.id}`}
                  className="text-sm font-medium text-leaf hover:underline"
                >
                  Receipt →
                </Link>
              </div>
            </div>
          );
        })}
        {!payments?.length && (
          <p className="text-sm text-ink-soft">No payments recorded yet.</p>
        )}
      </div>

      <Pagination basePath="/dashboard/admin/fees/payments" page={page} totalPages={totalPages} />
    </div>
  );
}