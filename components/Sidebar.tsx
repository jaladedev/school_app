"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/database";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_BY_ROLE: Record<UserRole, { label: string; href: string }[]> = {
  student: [
    { label: "My subjects", href: "/dashboard/student" },
    { label: "Timetable", href: "/dashboard/student/timetable" },
    { label: "Homework", href: "/dashboard/student/homework" },
    { label: "Grades", href: "/dashboard/student/grades" },
    { label: "Report Card", href: "/dashboard/student/report-card" },
    { label: "Fees", href: "/dashboard/student/fees" },
    { label: "My Notes", href: "/dashboard/student/notes" },
    { label: "Messages", href: "/dashboard/messages" },
    { label: "Announcements", href: "/dashboard/announcements" },
  ],
  teacher: [
    { label: "My classes", href: "/dashboard/teacher" },
    { label: "Timetable", href: "/dashboard/teacher/timetable" },
    { label: "Attendance", href: "/dashboard/teacher/attendance" },
    { label: "Homework", href: "/dashboard/teacher/homework" },
    { label: "Grades", href: "/dashboard/teacher/grades" },
    { label: "Messages", href: "/dashboard/messages" },
    { label: "Announcements", href: "/dashboard/announcements" },
  ],
  admin: [
    { label: "Overview", href: "/dashboard/admin" },
    { label: "Classes", href: "/dashboard/admin/classes" },
    { label: "Promote Students", href: "/dashboard/admin/classes/promote" },
    { label: "Subjects", href: "/dashboard/admin/subjects" },
    { label: "Students", href: "/dashboard/admin/students" },
    { label: "Timetables", href: "/dashboard/admin/timetables" },
    { label: "Staff", href: "/dashboard/admin/staff" },
    { label: "Grade Moderation", href: "/dashboard/admin/grades" },
    { label: "Fees", href: "/dashboard/admin/fees" },
    { label: "Messages", href: "/dashboard/messages" },
    { label: "Announcements", href: "/dashboard/announcements" },
    { label: "Settings", href: "/dashboard/admin/settings" },
  ],
};

/**
 * Picks the single most specific matching nav item for the current path,
 * so a nested route (e.g. /dashboard/admin/classes/promote) doesn't also
 * light up a shorter sibling/parent item (e.g. /dashboard/admin/classes)
 * whose href happens to be a string prefix of it.
 */
function findActiveHref(pathname: string, items: { href: string }[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (isMatch && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  const items = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname, items);

  return (
    <aside className="sticky top-0 flex h-screen w-56 flex-col justify-between border-r border-rule bg-paper px-4 py-6 print:hidden">
      <div className="min-h-0 overflow-y-auto">
        <div className="mb-8 px-2">
          <p className="font-display text-lg font-semibold text-ink">School</p>
          <p className="text-xs uppercase tracking-wide text-ink-soft">{role}</p>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-leaf-soft font-medium text-leaf"
                    : "text-ink hover:bg-leaf-soft hover:text-leaf"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="shrink-0 space-y-2 border-t border-rule px-2 pt-4">
        <p className="text-sm text-ink-soft">{fullName}</p>
        <SignOutButton />
      </div>
    </aside>
  );
}