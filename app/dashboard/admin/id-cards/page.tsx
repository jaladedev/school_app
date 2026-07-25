import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function IdCardsPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">ID Cards</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Print a sheet of ID cards for a class of students, or for all active staff.
      </p>

      <div className="mb-8 rounded-lg border border-rule bg-white p-4">
        <h2 className="mb-3 font-medium text-ink">Students by class</h2>
        <div className="space-y-2">
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/admin/id-cards/print?type=students&classId=${c.id}`}
              className="flex items-center justify-between rounded-lg border border-rule px-3 py-2 text-sm hover:bg-leaf-soft"
            >
              <span>
                {c.name} {c.arm ?? ""}
              </span>
              <span className="text-ink-soft">Print →</span>
            </Link>
          ))}
          {!classes?.length && <p className="text-sm text-ink-soft">No classes yet.</p>}
        </div>
      </div>

      <div className="rounded-lg border border-rule bg-white p-4">
        <h2 className="mb-3 font-medium text-ink">Staff</h2>
        <Link
          href="/dashboard/admin/id-cards/print?type=staff"
          className="flex items-center justify-between rounded-lg border border-rule px-3 py-2 text-sm hover:bg-leaf-soft"
        >
          <span>All active teaching staff</span>
          <span className="text-ink-soft">Print →</span>
        </Link>
      </div>
    </div>
  );
}
