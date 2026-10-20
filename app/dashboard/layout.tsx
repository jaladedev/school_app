import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { DashboardBreadcrumbs } from "@/components/DashboardBreadcrumbs";
import { ErrorState } from "@/components/ErrorState";
import { LicenseBanner } from "@/components/LicenseBanner";
import { licenseBanner, studentCapBanner } from "@/lib/license";
import { getLicenseInfo, getLicenseSummary, getEnabledFeatures } from "@/lib/licenseInfo";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    return (
      <div className="flex flex-col lg:flex-row">
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <ErrorState message={message} retryHref="/dashboard" />
        </main>
      </div>
    );
  }

  if (!profile) {
    redirect("/login");
  }

  const supabase = createClient();

  let staffRole = null;
  if (profile.role === "teacher") {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .single();
    staffRole = teacher?.staff_role ?? null;
  }

  const { data: counts } = await supabase.rpc("get_notification_counts").single();
  const licenseInfo = await getLicenseInfo();
  const enabledFeatures = await getEnabledFeatures();
  const banner = licenseBanner(licenseInfo);
  // Only the school admin sees the student-count warning (the database
  // function refuses everyone else, so don't even ask for other roles).
  const summary = profile.role === "admin" ? await getLicenseSummary() : null;
  const capBanner = summary ? studentCapBanner(summary.studentCount, summary.studentCap) : null;

  return (
    <div className="flex flex-col lg:flex-row">
      <Sidebar
        role={profile.role}
        fullName={profile.full_name}
        staffRole={staffRole}
        userId={profile.id}
        enabledFeatures={enabledFeatures}
        notificationCounts={{
          messages: counts?.unread_messages ?? 0,
          announcements: counts?.unread_announcements ?? 0,
          homework: counts?.unread_graded_homework ?? 0,
        }}
      />
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <LicenseBanner
          banner={banner}
          manageHref={profile.role === "admin" ? "/dashboard/admin/license" : undefined}
        />
        <LicenseBanner banner={capBanner} />
        <DashboardBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
