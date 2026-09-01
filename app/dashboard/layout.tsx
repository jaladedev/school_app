import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { DashboardBreadcrumbs } from "@/components/DashboardBreadcrumbs";
import { ErrorState } from "@/components/ErrorState";

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

  let staffRole = null;
  if (profile.role === "teacher") {
    const supabase = createClient();
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .single();
    staffRole = teacher?.staff_role ?? null;
  }

  return (
    <div className="flex flex-col lg:flex-row">
      <Sidebar role={profile.role} fullName={profile.full_name} staffRole={staffRole} />
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <DashboardBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
