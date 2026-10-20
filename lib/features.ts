// Per-school add-on features (licensing plan, section 4.3). Pure data and
// helpers, safe to import from server and client code.
//
// Core features (students, classes, timetable, attendance, grades, report
// cards, homework, quizzes, fees and payments, announcements, ID cards,
// exports) are never gated and have no entry here.

export const LICENSE_FEATURES = [
  "messaging",
  "transport",
  "hostel",
  "library",
  "bulk_email",
  "inventory",
] as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

export const FEATURE_LABELS: Record<LicenseFeature, { label: string; description: string }> = {
  messaging: {
    label: "Messaging",
    description: "Inbox and one-to-one messages between staff, parents and students",
  },
  transport: {
    label: "Transport",
    description: "Routes, stops, vehicles, student assignments and live tracking",
  },
  hostel: {
    label: "Hostel",
    description: "Hostels, rooms, waitlist and visitor log",
  },
  library: {
    label: "Library",
    description: "Book catalogue and loans",
  },
  bulk_email: {
    label: "Bulk email",
    description: "Announcements and fee reminders sent by email",
  },
  inventory: {
    label: "Inventory",
    description: "Assets register",
  },
};

export function isLicenseFeature(value: string): value is LicenseFeature {
  return (LICENSE_FEATURES as readonly string[]).includes(value);
}

// URL prefixes that belong to an add-on. Longest match wins, and a path
// matches a prefix only at a segment boundary (so "/dashboard/library"
// does not match "/dashboard/librarian").
const FEATURE_ROUTES: { prefix: string; feature: LicenseFeature }[] = [
  { prefix: "/dashboard/messages", feature: "messaging" },
  { prefix: "/dashboard/transport", feature: "transport" },
  { prefix: "/dashboard/driver", feature: "transport" },
  { prefix: "/dashboard/admin/transport", feature: "transport" },
  { prefix: "/dashboard/student/transport", feature: "transport" },
  { prefix: "/dashboard/parent/transport", feature: "transport" },
  { prefix: "/dashboard/hostels", feature: "hostel" },
  { prefix: "/dashboard/admin/hostels", feature: "hostel" },
  { prefix: "/dashboard/library", feature: "library" },
  { prefix: "/dashboard/admin/library", feature: "library" },
  { prefix: "/dashboard/student/library", feature: "library" },
  { prefix: "/dashboard/parent/library", feature: "library" },
  { prefix: "/dashboard/admin/bulk-email", feature: "bulk_email" },
  { prefix: "/dashboard/admin/inventory", feature: "inventory" },
];

/** The add-on a dashboard path belongs to, or null for core pages. */
export function featureForPath(path: string): LicenseFeature | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "");
  let best: { prefix: string; feature: LicenseFeature } | null = null;
  for (const route of FEATURE_ROUTES) {
    const matches = clean === route.prefix || clean.startsWith(`${route.prefix}/`);
    if (matches && (!best || route.prefix.length > best.prefix.length)) best = route;
  }
  return best?.feature ?? null;
}

/**
 * Hides navigation entries for add-ons the school does not have. `enabled`
 * is the list of enabled features.
 */
export function filterNavByFeatures<T extends { href: string }>(
  items: T[],
  enabled: readonly LicenseFeature[]
): T[] {
  return items.filter((item) => {
    const feature = featureForPath(item.href);
    return feature === null || enabled.includes(feature);
  });
}
