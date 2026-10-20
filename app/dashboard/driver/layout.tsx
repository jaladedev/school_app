import { redirect } from "next/navigation";
import { FeatureGate } from "@/components/FeatureGate";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    return <FeatureGate feature="transport">{children}</FeatureGate>;
  }

  if (profile.role === "teacher") {
    const supabase = createClient();
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .single();

    if (teacher?.staff_role === "driver") {
      return <FeatureGate feature="transport">{children}</FeatureGate>;
    }
  }

  redirect(`/dashboard/${profile.role}`);
}
