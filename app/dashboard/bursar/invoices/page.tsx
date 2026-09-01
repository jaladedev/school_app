import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, type InvoiceStatus } from "@/types/database";
import { getInvoiceStatusLabel } from "@/lib/invoiceStatus";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { VoidInvoiceForm } from "@/components/VoidInvoiceForm";
import { ApplyDiscountForm } from "@/components/ApplyDiscountForm";
import { InstallmentPlanForm } from "@/components/InstallmentPlanForm";
import { InstallmentScheduleView } from "@/components/InstallmentScheduleView";
import { ExportDefaultersButton } from "@/components/ExportDefaultersButton";
import { SendFeeRemindersButton } from "@/components/SendFeeRemindersButton";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-text",
  unpaid: "bg-clay/10 text-clay",
};

const VALID_STATUSES: InvoiceStatus[] = ["unpaid", "partial", "paid"];
const VALID_TABS = [...VALID_STATUSES, "voided"] as const;
type TabFilter = (typeof VALID_TABS)[number];

export default async function BursarInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const tabFilter = VALID_TABS.includes(resolvedSearchParams.status as TabFilter)
    ? (resolvedSearchParams.status as TabFilter)
    : undefined;
  const showingVoided = tabFilter === "voided";
  const statusFilter = showingVoided ? undefined : (tabFilter as InvoiceStatus | undefined);
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
    .select(
      "*, student_profiles(profiles(full_name), classes(name, arm)), fee_structures(title), invoice_installments(id, sequence_order, due_date, amount_kobo)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("sequence_order", { foreignTable: "invoice_installments", ascending: true });

  if (academicYear && term) {
    query = query.eq("academic_year", academicYear).eq("term", term);
  }

  if (showingVoided) {
    query = query.not("voided_at", "is", null);
  } else {
    query = query.is("voided_at", null);
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
  }

  const { data: invoices, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  let totalsQuery = supabase
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, amount_paid_kobo, status")
    .is("voided_at", null);
  if (academicYear && term) {
    totalsQuery = totalsQuery.eq("academic_year", academicYear).eq("term", term);
  }
  const { data: totalsRows } = await totalsQuery;

  let totalBilled = 0;
  let totalCollected = 0;
  let defaulterCount = 0;
  for (const row of totalsRows ?? []) {
    totalBilled += row.total_amount_kobo - row.discount_kobo;
    totalCollected += row.amount_paid_kobo;
    if (row.status !== "paid") defaulterCount += 1;
  }
  const totalOutstanding = totalBilled - totalCollected;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Invoices & Payments</h1>
        <div className="flex gap-2">
          <ExportDefaultersButton />
          <SendFeeRemindersButton />
          <Link
            href="/dashboard/bursar/payments"
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        {["all", "unpaid", "partial", "paid", "voided"].map((s) => (
          <Link
            key={s}
            href={
              s === "all" ? "/dashboard/bursar/invoices" : `/dashboard/bursar/invoices?status=${s}`
            }
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              (tabFilter ?? "all") === s
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
          const isVoided = Boolean(inv.voided_at);

          return (
            <div
              key={inv.id}
              className={`rounded-lg border border-rule bg-white p-4 ${isVoided ? "opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{profile?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-ink-soft">
                    {cls?.name} {cls?.arm} · {inv.fee_structures?.title}
                  </p>
                </div>
                <div className="text-right">
                  {isVoided ? (
                    <span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-medium text-clay">
                      Voided
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                    >
                      {getInvoiceStatusLabel(status, inv.amount_paid_kobo, owed)}
                    </span>
                  )}
                  <p className="mt-1 text-sm text-ink">
                    {formatKobo(inv.amount_paid_kobo)} / {formatKobo(owed)}
                  </p>
                  {!isVoided && balance > 0 && (
                    <p className="text-xs text-clay">{formatKobo(balance)} outstanding</p>
                  )}
                  {!isVoided && inv.discount_kobo > 0 && (
                    <p className="text-xs text-marigold-text">
                      {formatKobo(inv.discount_kobo)} discount applied
                    </p>
                  )}
                </div>
              </div>
              {isVoided ? (
                <p className="mt-2 text-xs text-ink-soft">
                  Voided {new Date(inv.voided_at!).toLocaleDateString()}
                  {inv.void_reason ? ` — ${inv.void_reason}` : ""}
                </p>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-3">
                    {status !== "paid" && <RecordPaymentForm invoiceId={inv.id} />}
                    <ApplyDiscountForm
                      invoiceId={inv.id}
                      totalAmountKobo={inv.total_amount_kobo}
                      currentDiscountKobo={inv.discount_kobo}
                    />
                    {status !== "paid" && (
                      <InstallmentPlanForm
                        invoiceId={inv.id}
                        netPayableKobo={owed}
                        hasExistingPlan={!!inv.invoice_installments?.length}
                        initialRows={inv.invoice_installments?.map((i) => ({
                          dueDate: i.due_date,
                          amountNaira: String(i.amount_kobo / 100),
                        }))}
                      />
                    )}
                    {inv.amount_paid_kobo === 0 && <VoidInvoiceForm invoiceId={inv.id} />}
                  </div>
                  {!!inv.invoice_installments?.length && (
                    <InstallmentScheduleView
                      installments={inv.invoice_installments}
                      amountPaidKobo={inv.amount_paid_kobo}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}

        {!invoices?.length && <EmptyState message="No invoices found." />}
      </div>

      <Pagination
        basePath="/dashboard/bursar/invoices"
        page={page}
        totalPages={totalPages}
        searchParams={{ status: statusFilter }}
      />
    </div>
  );
}
