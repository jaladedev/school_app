"use client";

import { useEffect, useState } from "react";
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
  // Parent portal routes (linked children, read-only attendance/grades/
  // report-card/fees/homework/timetable) don't exist yet — only
  // Messages and Announcements are real, working routes for any signed-in
  // role today. Add the rest here as those pages get built; a link to a
  // route that doesn't exist would 404, which is worse than a short list.
  parent: [
    { label: "Messages", href: "/dashboard/messages" },
    { label: "Announcements", href: "/dashboard/announcements" },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer automatically on navigation — otherwise it stays
  // open over the new page until manually dismissed.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar — hidden from lg upward, where the sidebar is
          always visible instead. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper px-4 py-3 lg:hidden print:hidden">
        <p className="font-display text-lg font-semibold text-ink">School</p>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="rounded-lg border border-rule p-2 text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Backdrop — only rendered (and only intercepts clicks) while the
          mobile drawer is open. */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col justify-between border-r border-rule bg-paper px-4 py-6 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-56 lg:translate-x-0 print:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="min-h-0 overflow-y-auto">
          <div className="mb-8 flex items-center justify-between px-2">
            <div>
              <p className="font-display text-lg font-semibold text-ink">School</p>
              <p className="text-xs uppercase tracking-wide text-ink-soft">{role}</p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="rounded-lg p-1 text-ink-soft lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
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
    </>
  );
}
