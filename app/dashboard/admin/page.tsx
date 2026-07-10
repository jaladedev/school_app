import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function count(supabase: ReturnType<typeof createClient>, table: string) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminOverview() {
  const supabase = createClient();

  const [studentCount, teacherCount, classCount, subjectCount] = await Promise.all([
    count(supabase, "student_profiles"),
    count(supabase, "teacher_profiles"),
    count(supabase, "classes"),
    count(supabase, "subjects"),
  ]);

  const { data: recentAnnouncements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { label: "Students", value: studentCount, href: "/dashboard/admin/classes" },
    { label: "Teachers", value: teacherCount, href: "/dashboard/admin/staff" },
    { label: "Classes", value: classCount, href: "/dashboard/admin/classes" },
    { label: "Subjects", value: subjectCount, href: "/dashboard/admin/classes" },
  ];

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        School overview
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        A snapshot of enrollment, staffing, and recent activity.
      </p>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf"
          >
            <p className="font-display text-3xl font-semibold text-ink">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Link
          href="/dashboard/admin/classes"
          className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf"
        >
          <p className="font-display text-lg font-semibold text-ink">Classes</p>
          <p className="mt-1 text-sm text-ink-soft">
            Create classes, manage arms and academic years.
          </p>
        </Link>
        <Link
          href="/dashboard/admin/timetables"
          className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf"
        >
          <p className="font-display text-lg font-semibold text-ink">Timetables</p>
          <p className="mt-1 text-sm text-ink-soft">
            Build weekly schedules with conflict detection.
          </p>
        </Link>
        <Link
          href="/dashboard/admin/staff"
          className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf"
        >
          <p className="font-display text-lg font-semibold text-ink">Staff</p>
          <p className="mt-1 text-sm text-ink-soft">
            Assign teacher roles and subjects taught.
          </p>
        </Link>
      </div>

      <h2 className="mb-3 mt-10 font-display text-lg font-semibold text-ink">
        Recent announcements
      </h2>
      <div className="space-y-2">
        {recentAnnouncements?.map((a) => (
          <div key={a.id} className="rounded-lg border border-rule bg-white px-4 py-3">
            <p className="font-medium text-ink">{a.title}</p>
            <p className="text-sm text-ink-soft">{a.content}</p>
          </div>
        ))}
        {!recentAnnouncements?.length && (
          <p className="text-sm text-ink-soft">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}
