import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function BursarLayout({ children }: { children: React.ReactNode }) {
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

    if (teacher?.staff_role === "bursar") {
      return <>{children}</>;
    }
  }

  redirect(`/dashboard/${profile.role}`);
}
