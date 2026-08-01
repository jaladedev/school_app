import { createClient } from "@/lib/supabase/server";
import { BulkEmailComposer } from "@/components/BulkEmailComposer";

export default async function AdminBulkEmailPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  const classOptions = (classes ?? []).map((c) => ({
    id: c.id,
    label: `${c.name} ${c.arm ?? ""}`.trim(),
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Bulk Email</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Send an email to a group of students, parents, teachers, or admins — optionally narrowed to
        one class.
      </p>

      <BulkEmailComposer classOptions={classOptions} />
    </div>
  );
}
