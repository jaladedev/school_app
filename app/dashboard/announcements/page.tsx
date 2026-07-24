import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { redirect } from "next/navigation";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const profile = await getCurrentProfile();
  const page = parsePage(resolvedSearchParams.page);

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

  const totalPages = Math.max(1, Math.ceil(visible.length / DEFAULT_PAGE_SIZE));
  const pageStart = (page - 1) * DEFAULT_PAGE_SIZE;
  const pageItems = visible.slice(pageStart, pageStart + DEFAULT_PAGE_SIZE);

  const { data: classes } = canPost
    ? await supabase.from("classes").select("id, name, arm").order("name")
    : { data: [] };

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Announcements</h1>
          <p className="text-sm text-ink-soft">Updates from the school, relevant to you.</p>
        </div>
        {canPost && <AnnouncementForm authorId={profile.id} classes={classes ?? []} />}
      </div>

      <div className="space-y-3">
        {pageItems.map((a) => (
          <AnnouncementCard
            key={a.id}
            id={a.id}
            title={a.title}
            content={a.content}
            authorName={a.profiles?.full_name ?? "School"}
            audience={a.audience}
            createdAt={a.created_at}
            timeAgo={timeAgo(a.created_at)}
          />
        ))}

        {!visible.length && <EmptyState message="No announcements yet." />}
      </div>

      <Pagination basePath="/dashboard/announcements" page={page} totalPages={totalPages} />
    </div>
  );
}
