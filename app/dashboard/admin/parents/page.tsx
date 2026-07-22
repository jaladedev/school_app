import { createClient } from "@/lib/supabase/server";
import { CreateParentForm } from "@/components/CreateParentForm";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeactivateUserButton } from "@/components/DeactivateUserButton";

export default async function AdminParentsPage() {
  const supabase = createClient();

  const { data: parents } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("role", "parent")
    .order("full_name");

  const { data: links } = await supabase
    .from("guardian_links")
    .select("parent_id, relationship, is_primary, student_profiles(profiles(full_name), classes(name, arm))");

  const childrenByParent = new Map<
    string,
    { name: string; className: string | null; relationship: string | null; isPrimary: boolean }[]
  >();
  for (const l of links ?? []) {
    const list = childrenByParent.get(l.parent_id) ?? [];
    list.push({
      name: l.student_profiles?.profiles?.full_name ?? "Unknown",
      className: l.student_profiles?.classes
        ? `${l.student_profiles.classes.name} ${l.student_profiles.classes.arm ?? ""}`.trim()
        : null,
      relationship: l.relationship,
      isPrimary: l.is_primary,
    });
    childrenByParent.set(l.parent_id, list);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Parents</h1>
          <p className="text-sm text-ink-soft">{parents?.length ?? 0} parent accounts.</p>
        </div>
        <CreateParentForm />
      </div>

      <div className="space-y-2">
        {parents?.map((p) => {
          const children = childrenByParent.get(p.id) ?? [];
          return (
            <div
              key={p.id}
              className={`rounded-lg border border-rule bg-white px-4 py-3 ${!p.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">
                    {p.full_name}
                    {!p.is_active && <span className="ml-2 text-xs font-normal text-clay">(deactivated)</span>}
                  </p>
                  <p className="text-sm text-ink-soft">{p.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ResetPasswordButton userId={p.id} />
                  <DeactivateUserButton userId={p.id} isActive={p.is_active} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {children.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-leaf-soft px-2.5 py-1 text-xs text-leaf"
                  >
                    {c.name}
                    {c.relationship ? ` (${c.relationship})` : ""}
                    {c.className ? ` · ${c.className}` : ""}
                  </span>
                ))}
                {!children.length && (
                  <span className="text-xs text-ink-soft">No children linked</span>
                )}
              </div>
            </div>
          );
        })}

        {!parents?.length && <p className="text-sm text-ink-soft">No parent accounts yet.</p>}
      </div>
    </div>
  );
}