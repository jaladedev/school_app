import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

/**
 * Shared hostel routes for staff who aren't admins: a house parent runs a
 * hostel day to day. Mirrors app/dashboard/library/layout.tsx. Without this
 * the sidebar's "Hostel" link (/dashboard/hostels) had no page behind it,
 * and the room page below was reachable by any signed-in role.
 */
export default async function HostelsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    return <>{children}</>;
  }

  if (profile.role === "teacher") {
    const supabase = createClient();
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .single();

    if (teacher?.staff_role === "house_parent") {
      return <>{children}</>;
    }
  }

  redirect(`/dashboard/${profile.role}`);
}
