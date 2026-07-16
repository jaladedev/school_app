import { createClient } from "@/lib/supabase/server";
import { formatKobo, type InvoiceStatus } from "@/types/database";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-leaf-soft text-leaf",
  partial: "bg-marigold/20 text-marigold-dark",
  unpaid: "bg-clay/10 text-clay",
};

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createClient();
  const statusFilter = searchParams.status;
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("invoices")
    .select("*, student_profiles(profiles(full_name), classes(name, arm)), fee_structures(title)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter as InvoiceStatus);
  }

  const { data: invoices, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, amount_paid_kobo, status");

  const totalBilled = (allInvoices ?? []).reduce(
    (sum, i) => sum + (i.total_amount_kobo - i.discount_kobo),
    0
  );
  const totalCollected = (allInvoices ?? []).reduce((sum, i) => sum + i.amount_paid_kobo, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const defaulterCount = (allInvoices ?? []).filter((i) => i.status === "unpaid").length;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Invoices & Payments
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Record payments as they come in — cash, bank transfer, or other offline methods. Card
        payments made online through the student portal are recorded automatically once verified.
      </p>

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
          <a
            key={s}
            href={s === "all" ? "/dashboard/admin/fees/invoices" : `/dashboard/admin/fees/invoices?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              (statusFilter ?? "all") === s
                ? "border-leaf bg-leaf-soft text-leaf"
                : "border-rule text-ink-soft"
            }`}
          >
            {s}
          </a>
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
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
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

        {!invoices?.length && (
          <p className="text-sm text-ink-soft">No invoices found.</p>
        )}
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