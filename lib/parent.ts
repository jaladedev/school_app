import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export type LinkedChild = {
  id: string;
  fullName: string;
  className: string | null;
};

// Every child linked to the current parent, for the child switcher.
export async function getLinkedChildren(): Promise<LinkedChild[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = createClient();

  const { data: links } = await supabase
    .from("guardian_links")
    .select("student_id, student_profiles(profiles(full_name), classes(name, arm))")
    .eq("parent_id", profile.id);

  return (links ?? []).map((l) => ({
    id: l.student_id,
    fullName: l.student_profiles?.profiles?.full_name ?? "Unknown",
    className: l.student_profiles?.classes
      ? `${l.student_profiles.classes.name} ${l.student_profiles.classes.arm ?? ""}`.trim()
      : null,
  }));
}

// Resolves which child a parent page should show: the ?child= query
// param if it's actually one of theirs, otherwise their first linked
// child. Returns null if they have no linked children at all.
export async function resolveSelectedChild(
  requestedChildId: string | undefined
): Promise<LinkedChild | null> {
  const children = await getLinkedChildren();
  if (!children.length) return null;

  if (requestedChildId) {
    const match = children.find((c) => c.id === requestedChildId);
    if (match) return match;
  }

  return children[0];
}
