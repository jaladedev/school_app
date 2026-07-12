"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StudentDetailTabs({ studentId }: { studentId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/admin/students/${studentId}`;

  const tabs = [
    { label: "Info", href: base },
    { label: "Attendance", href: `${base}/attendance` },
    { label: "Grades", href: `${base}/grades` },
    { label: "Notes", href: `${base}/notes` },
    { label: "Report Card", href: `${base}/report-card` },
  ];

  return (
    <div className="mb-6 flex gap-1 border-b border-rule">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "border-leaf text-leaf"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}