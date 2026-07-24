import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, type InvoiceStatus } from "@/types/database";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { ExportDefaultersButton } from "@/components/ExportDefaultersButton";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-dark",
  unpaid: "bg-clay/10 text-clay",
};

const VALID_STATUSES: InvoiceStatus[] = ["unpaid", "partial", "paid"];

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const statusFilter = VALID_STATUSES.includes(resolvedSearchParams.status as InvoiceStatus)
    ? (resolvedSearchParams.status as InvoiceStatus)
    : undefined;
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  const academicYear = settings?.current_academic_year;
  const term = settings?.current_term;

  let query = supabase
    .from("invoices")
    .select("*, student_profiles(profiles(full_name), classes(name, arm)), fee_structures(title)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (academicYear && term) {
    query = query.eq("academic_year", academicYear).eq("term", term);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: invoices, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const { data: totals } = await supabase.rpc("invoice_dashboard_totals").single();
  const totalBilled = totals?.total_billed ?? 0;
  const totalCollected = totals?.total_collected ?? 0;
  const totalOutstanding = totals?.total_outstanding ?? 0;
  const defaulterCount = totals?.unpaid_invoice_count ?? 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Invoices & Payments</h1>
        <div className="flex gap-2">
          <ExportDefaultersButton />
          <Link
            href="/dashboard/admin/fees/payments"
            className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            Payment history
          </Link>
        </div>
      </div>
      <p className="mb-1 text-sm text-ink-soft">
        Record payments as they come in — cash, bank transfer, or other offline methods. Card
        payments made online through the student portal are recorded automatically once verified.
      </p>
      {academicYear && term && (
        <p className="mb-6 text-xs text-ink-soft">
          Showing {academicYear}, term {term}
        </p>
      )}

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Total billed</p>
          <p className="font-display text-lg font-semibold text-ink">{formatKobo(totalBilled)}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Collected</p>
          <p className="font-display text-lg font-semibold text-leaf">
            {formatKobo(totalCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Outstanding</p>
          <p className="font-display text-lg font-semibold text-clay">
            {formatKobo(totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Unpaid invoices</p>
          <p className="font-display text-lg font-semibold text-ink">{defaulterCount}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {["all", "unpaid", "partial", "paid"].map((s) => (
          <Link
            key={s}
            href={
              s === "all"
                ? "/dashboard/admin/fees/invoices"
                : `/dashboard/admin/fees/invoices?status=${s}`
            }
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              (statusFilter ?? "all") === s
                ? "border-leaf bg-leaf-soft text-leaf"
                : "border-rule text-ink-soft"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {invoices?.map((inv) => {
          const studentProfile = inv.student_profiles;
          const profile = studentProfile?.profiles;
          const cls = studentProfile?.classes;
          const owed = inv.total_amount_kobo - inv.discount_kobo;
          const balance = owed - inv.amount_paid_kobo;
          const status = inv.status as InvoiceStatus;

          return (
            <div key={inv.id} className="rounded-lg border border-rule bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{profile?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-ink-soft">
                    {cls?.name} {cls?.arm} · {inv.fee_structures?.title}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
                  >
                    {status}
                  </span>
                  <p className="mt-1 text-sm text-ink">
                    {formatKobo(inv.amount_paid_kobo)} / {formatKobo(owed)}
                  </p>
                  {balance > 0 && (
                    <p className="text-xs text-clay">{formatKobo(balance)} outstanding</p>
                  )}
                </div>
              </div>
              {status !== "paid" && <RecordPaymentForm invoiceId={inv.id} />}
            </div>
          );
        })}

        {!invoices?.length && <EmptyState message="No invoices found." />}
      </div>

      <Pagination
        basePath="/dashboard/admin/fees/invoices"
        page={page}
        totalPages={totalPages}
        searchParams={{ status: statusFilter }}
      />
    </div>
  );
}
