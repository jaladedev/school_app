import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { redirect } from "next/navigation";

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default async function AnnouncementsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const canPost = profile?.role === "admin" || profile?.role === "teacher";

  // Work out which class_id(s) are relevant to this viewer, so a
  // class-targeted announcement only shows to that class.
  let relevantClassIds: string[] = [];

  if (profile?.role === "student") {
    const { data: studentProfile } = await supabase
      .from("student_profiles")
      .select("class_id")
      .eq("id", profile.id)
      .single();
    if (studentProfile?.class_id) relevantClassIds = [studentProfile.class_id];
  } else if (profile?.role === "teacher") {
    const { data: entries } = await supabase
      .from("timetable_entries")
      .select("class_id")
      .eq("teacher_id", profile.id);
    relevantClassIds = [...new Set((entries ?? []).map((e) => e.class_id))];
  }

  const audienceFilter =
    profile?.role === "student"
      ? ["all", "students"]
      : profile?.role === "teacher"
      ? ["all", "teachers"]
      : ["all", "students", "teachers", "class"];

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  const visible = (announcements ?? []).filter((a) => {
    if (profile?.role === "admin") return true;
    if (a.audience === "class") return relevantClassIds.includes(a.class_id ?? "");
    return audienceFilter.includes(a.audience);
  });

  const { data: classes } = canPost
    ? await supabase.from("classes").select("id, name, arm").order("name")
    : { data: [] };

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Announcements
          </h1>
          <p className="text-sm text-ink-soft">
            Updates from the school, relevant to you.
          </p>
        </div>
        {canPost && <AnnouncementForm authorId={profile.id} classes={classes ?? []} />}
      </div>

      <div className="space-y-3">
        {visible.map((a) => (
          <div key={a.id} className="rounded-xl border border-rule bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-ink">{a.title}</p>
              <span className="text-xs text-ink-soft">{timeAgo(a.created_at)}</span>
            </div>
            <p className="mb-2 text-sm text-ink">{a.content}</p>
            <p className="text-xs text-ink-soft">
              {a.profiles?.full_name ?? "School"} ·{" "}
              {a.audience === "class" ? "This class" : a.audience}
            </p>
          </div>
        ))}

        {!visible.length && (
          <p className="text-sm text-ink-soft">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}