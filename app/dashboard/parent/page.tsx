import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { formatKobo } from "@/types/database";

export default async function ParentHome({
  searchParams,
}: {
  searchParams: { child?: string };
}) {
  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(searchParams.child);

  if (!selected) {
    return (
      <div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Welcome</h1>
        <p className="text-sm text-ink-soft">
          No children are linked to your account yet — contact the school office.
        </p>
      </div>
    );
  }

  const supabase = createClient();

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", selected.id);

  const total = attendanceRows?.length ?? 0;
  const present = (attendanceRows ?? []).filter((r) => r.status === "present").length;
  const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, amount_paid_kobo")
    .eq("student_id", selected.id);

  const balance = (invoices ?? []).reduce(
    (sum, i) => sum + (i.total_amount_kobo - i.discount_kobo - i.amount_paid_kobo),
    0
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {selected.fullName}
      </h1>
      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Attendance</p>
          <p className="font-display text-2xl font-semibold text-ink">
            {attendancePercent !== null ? `${attendancePercent}%` : "—"}
          </p>
          <Link
            href={`/dashboard/parent/attendance?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View details →
          </Link>
        </div>

        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Fee balance</p>
          <p className={`font-display text-2xl font-semibold ${balance > 0 ? "text-clay" : "text-leaf"}`}>
            {formatKobo(balance)}
          </p>
          <Link
            href={`/dashboard/parent/fees?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View invoices →
          </Link>
        </div>

        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Report card</p>
          <p className="text-sm text-ink-soft">See grades and class position.</p>
          <Link
            href={`/dashboard/parent/report-card?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View report card →
          </Link>
        </div>
      </div>
    </div>
  );
}