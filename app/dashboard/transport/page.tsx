import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TransportOfficerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();

  if (profile.role !== "admin") {
    const { data: teacherProfile } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .maybeSingle();
    if (teacherProfile?.staff_role !== "transport_officer") {
      redirect(`/dashboard/${profile.role}`);
    }
  }

  const tripDate = todayIso();

  const { data: routes } = await supabase
    .from("transport_routes")
    .select("id, name, vehicles(plate_number)")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  const { data: activeAssignments } = await supabase
    .from("transport_assignments")
    .select("route_id")
    .is("unassigned_at", null);

  const riderCountByRoute = new Map<string, number>();
  for (const a of activeAssignments ?? []) {
    riderCountByRoute.set(a.route_id, (riderCountByRoute.get(a.route_id) ?? 0) + 1);
  }

  const { data: tripStatuses } = await supabase
    .from("transport_trip_status")
    .select("route_id, direction, status")
    .eq("trip_date", tripDate);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Transport</h1>
      <p className="mb-6 text-sm text-ink-soft">Today&apos;s routes and live status.</p>

      <div className="space-y-2">
        {(routes ?? []).map((r) => {
          const morning = tripStatuses?.find(
            (t) => t.route_id === r.id && t.direction === "morning"
          );
          const afternoon = tripStatuses?.find(
            (t) => t.route_id === r.id && t.direction === "afternoon"
          );
          return (
            <Link
              key={r.id}
              href={`/dashboard/transport/routes/${r.id}`}
              className="flex items-center justify-between rounded-lg border border-rule bg-white p-3 text-sm hover:bg-leaf-soft"
            >
              <div>
                <p className="font-medium text-ink">{r.name}</p>
                <p className="text-xs text-ink-soft">
                  {r.vehicles?.plate_number ?? "No vehicle"} · {riderCountByRoute.get(r.id) ?? 0}{" "}
                  riders · AM: {morning?.status ?? "not started"} · PM:{" "}
                  {afternoon?.status ?? "not started"}
                </p>
              </div>
              <span className="text-ink-soft">Manage →</span>
            </Link>
          );
        })}
        {!routes?.length && (
          <EmptyState message="No routes set up yet — ask an admin to add some." />
        )}
      </div>
    </div>
  );
}
