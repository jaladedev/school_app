import { createClient } from "@/lib/supabase/server";
import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { EmptyState } from "@/components/EmptyState";
import { isLoanOverdue } from "@/types/database";

export default async function ParentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(resolvedSearchParams.child);

  if (!selected) {
    return <p className="text-sm text-ink-soft">No children linked to your account.</p>;
  }

  const supabase = createClient();

  const { data: loans } = await supabase
    .from("library_loans")
    .select("*, library_books(title, author)")
    .eq("student_id", selected.id)
    .order("borrowed_at", { ascending: false });

  const active = (loans ?? []).filter((l) => !l.returned_at);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Library</h1>
      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />

      <div className="mt-6 space-y-2">
        {active.map((loan) => {
          const overdue = isLoanOverdue(loan);
          return (
            <div
              key={loan.id}
              className={`rounded-lg border bg-white px-4 py-3 ${overdue ? "border-clay" : "border-rule"}`}
            >
              <p className="font-medium text-ink">{loan.library_books?.title}</p>
              <p className="text-xs text-ink-soft">
                {loan.library_books?.author && `${loan.library_books.author} · `}
                Due{" "}
                {new Date(loan.due_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {overdue && <span className="ml-1 font-medium text-clay">· Overdue</span>}
              </p>
            </div>
          );
        })}
        {!active.length && <EmptyState message="No books currently borrowed." />}
      </div>
    </div>
  );
}
