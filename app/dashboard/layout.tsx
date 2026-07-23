import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { DashboardBreadcrumbs } from "@/components/DashboardBreadcrumbs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col lg:flex-row">
      <Sidebar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <DashboardBreadcrumbs />
        {children}
      </main>
    </div>
  );
}
