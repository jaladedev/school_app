import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex">
      <Sidebar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
