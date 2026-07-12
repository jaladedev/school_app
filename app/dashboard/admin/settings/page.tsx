import { createClient } from "@/lib/supabase/server";
import { SchoolSettingsForm } from "@/components/SchoolSettingsForm";

export default async function AdminSettingsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        School settings
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Identity, current session, and grading scale used across the app.
      </p>

      {settings ? (
        <SchoolSettingsForm settings={settings} />
      ) : (
        <p className="text-sm text-clay">
          Settings row not found — make sure 17_school_settings.sql has been run.
        </p>
      )}
    </div>
  );
}