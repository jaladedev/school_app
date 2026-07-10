import Link from "next/link";
import type { UserRole } from "@/types/database";

const NAV_BY_ROLE: Record<UserRole, { label: string; href: string }[]> = {
  student: [
    { label: "My subjects", href: "/dashboard/student" },
    { label: "Timetable", href: "/dashboard/student/timetable" },
    { label: "Grades", href: "/dashboard/student/grades" },
    { label: "Announcements", href: "/dashboard/announcements" },
  ],
  teacher: [
    { label: "My classes", href: "/dashboard/teacher" },
    { label: "Timetable", href: "/dashboard/teacher/timetable" },
    { label: "Attendance", href: "/dashboard/teacher/attendance" },
    { label: "Grades", href: "/dashboard/teacher/grades" },
    { label: "Announcements", href: "/dashboard/announcements" },
  ],
  admin: [
    { label: "Overview", href: "/dashboard/admin" },
    { label: "Classes", href: "/dashboard/admin/classes" },
    { label: "Timetables", href: "/dashboard/admin/timetables" },
    { label: "Staff", href: "/dashboard/admin/staff" },
    { label: "Announcements", href: "/dashboard/announcements" },
  ],
};

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  const items = NAV_BY_ROLE[role];

  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-rule bg-paper px-4 py-6">
      <div>
        <div className="mb-8 px-2">
          <p className="font-display text-lg font-semibold text-ink">School</p>
          <p className="text-xs uppercase tracking-wide text-ink-soft">{role}</p>
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-leaf-soft hover:text-leaf"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-rule px-2 pt-4 text-sm text-ink-soft">
        {fullName}
      </div>
    </aside>
  );
}
