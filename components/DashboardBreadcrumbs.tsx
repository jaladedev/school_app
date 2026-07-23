"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  parent: "Parent",
  student: "Student",
  teacher: "Teacher",
  classes: "Classes",
  promote: "Promote Students",
  subjects: "Subjects",
  students: "Students",
  parents: "Parents",
  timetables: "Timetables",
  staff: "Staff",
  grades: "Grades",
  fees: "Fees",
  messages: "Messages",
  announcements: "Announcements",
  settings: "Settings",
  attendance: "Attendance",
  homework: "Homework",
  report: "Report Card",
  notes: "Notes",
  topics: "Topics",
  receipt: "Receipt",
};

function toTitleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(segment: string) {
  if (LABELS[segment]) return LABELS[segment];

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return "Details";
  }

  return toTitleCase(segment);
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbSegments = segments.slice(1);
  const crumbs = crumbSegments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 2).join("/")}`;
    const isLast = index === crumbSegments.length - 1;
    const label = labelForSegment(segment);

    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {crumb.isLast ? (
              <span className="font-medium text-ink">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-leaf hover:underline">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
