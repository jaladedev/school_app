import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "driver") {
    redirect(`/dashboard/${profile.role}`);
  }

  return <>{children}</>;
}
