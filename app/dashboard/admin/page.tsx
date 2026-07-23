import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

async function count(supabase: ReturnType<typeof createClient>, table: string) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
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

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name")
    .eq("id", 1)
    .maybeSingle();

  const stats = [
    { label: "Students", value: studentCount, href: "/dashboard/admin/students" },
    { label: "Teachers", value: teacherCount, href: "/dashboard/admin/staff" },
    { label: "Classes", value: classCount, href: "/dashboard/admin/classes" },
    { label: "Subjects", value: subjectCount, href: "/dashboard/admin/subjects" },
  ];

  const onboardingSteps = [
    {
      label: "Confirm school settings",
      href: "/dashboard/admin/settings",
      complete: !!settings?.name,
    },
    { label: "Create subjects", href: "/dashboard/admin/subjects", complete: subjectCount > 0 },
    { label: "Create classes", href: "/dashboard/admin/classes", complete: classCount > 0 },
    { label: "Add teachers", href: "/dashboard/admin/staff", complete: teacherCount > 0 },
    { label: "Enroll students", href: "/dashboard/admin/students", complete: studentCount > 0 },
  ];
  const remainingSteps = onboardingSteps.filter((step) => !step.complete);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">School overview</h1>
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
            <p className="font-display text-3xl font-semibold text-ink">{stat.value}</p>
            <p className="mt-1 text-sm text-ink-soft">{stat.label}</p>
          </Link>
        ))}
      </div>

      {remainingSteps.length > 0 && (
        <section className="mb-10 rounded-xl border border-rule bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Get your school ready</h2>
              <p className="text-sm text-ink-soft">
                {remainingSteps.length} setup step{remainingSteps.length === 1 ? "" : "s"}{" "}
                remaining.
              </p>
            </div>
            <span className="text-xs font-medium text-leaf">
              {onboardingSteps.length - remainingSteps.length}/{onboardingSteps.length} complete
            </span>
          </div>
          <ol className="space-y-2">
            {onboardingSteps.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    step.complete ? "text-ink-soft" : "bg-paper text-ink hover:bg-leaf-soft"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.complete
                        ? "bg-leaf text-white"
                        : "border border-rule bg-white text-ink-soft"
                    }`}
                  >
                    {step.complete ? "✓" : index + 1}
                  </span>
                  <span className={step.complete ? "line-through" : "font-medium"}>
                    {step.label}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

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
          <p className="mt-1 text-sm text-ink-soft">Assign teacher roles and subjects taught.</p>
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
        {!recentAnnouncements?.length && <EmptyState message="No announcements yet." />}
      </div>
    </div>
  );
}
