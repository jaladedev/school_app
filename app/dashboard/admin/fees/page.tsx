import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateFeeStructureForm } from "@/components/CreateFeeStructureForm";
import { GenerateInvoicesButton } from "@/components/GenerateInvoicesButton";
import { formatLevel, formatKobo } from "@/types/database";

export default async function AdminFeesPage() {
  const supabase = createClient();

  const { data: structures } = await supabase
    .from("fee_structures")
    .select("*")
    .order("academic_year", { ascending: false })
    .order("term", { ascending: true });

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm, education_level, level_number")
    .eq("is_archived", false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Fee Structures</h1>
          <p className="text-sm text-ink-soft">
            Define fees per stage/term, then generate invoices for a class.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/admin/fees/invoices"
            className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            View invoices & payments
          </Link>
          <CreateFeeStructureForm />
        </div>
      </div>

      <div className="space-y-2">
        {structures?.map((s) => {
          const matchingClasses = (classes ?? []).filter(
            (c) => c.education_level === s.education_level && c.level_number === s.level_number
          );
          return (
            <div key={s.id} className="rounded-lg border border-rule bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-sm text-ink-soft">
                    {formatLevel(s.education_level, s.level_number)} · Term {s.term} ·{" "}
                    {s.academic_year}
                    {s.due_date && ` · Due ${s.due_date}`}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-leaf">
                  {formatKobo(s.amount_kobo)}
                </span>
              </div>
              <GenerateInvoicesButton feeStructureId={s.id} classes={matchingClasses} />
            </div>
          );
        })}

        {!structures?.length && (
          <p className="text-sm text-ink-soft">No fee structures created yet.</p>
        )}
      </div>
    </div>
  );
}