import { getCurrentProfile, createClient } from "@/lib/supabase/server";
import { TripStatusControls } from "@/components/TripStatusControls";
import { EmptyState } from "@/components/EmptyState";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverHomePage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();
  const tripDate = todayIso();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, plate_number, model, capacity")
    .eq("driver_profile_id", profile!.id)
    .maybeSingle();

  if (!vehicle) {
    return (
      <div className="max-w-lg p-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My Route</h1>
        <p className="text-sm text-ink-soft">
          You aren&apos;t currently linked to a vehicle. Ask an admin to link your account from
          Transport management.
        </p>
      </div>
    );
  }

  const { data: routes } = await supabase
    .from("transport_routes")
    .select("id, name")
    .eq("vehicle_id", vehicle.id)
    .eq("is_archived", false);

  const routeIds = (routes ?? []).map((r) => r.id);

  const { data: tripStatuses } = routeIds.length
    ? await supabase
        .from("transport_trip_status")
        .select("route_id, direction, status")
        .in("route_id", routeIds)
        .eq("trip_date", tripDate)
    : { data: [] };

  const { data: riders } = routeIds.length
    ? await supabase
        .from("transport_assignments")
        .select(
          "route_id, student_profiles(admission_no, profiles(full_name)), transport_stops(name)"
        )
        .in("route_id", routeIds)
        .is("unassigned_at", null)
    : { data: [] };

  return (
    <div className="max-w-2xl p-6">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My Route</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {vehicle.plate_number}
        {vehicle.model ? ` · ${vehicle.model}` : ""} · {vehicle.capacity} seats
      </p>

      {(routes ?? []).map((route) => {
        const morning =
          tripStatuses?.find((t) => t.route_id === route.id && t.direction === "morning")?.status ??
          "not_started";
        const afternoon =
          tripStatuses?.find((t) => t.route_id === route.id && t.direction === "afternoon")
            ?.status ?? "not_started";
        const routeRiders = (riders ?? []).filter((r) => r.route_id === route.id);

        return (
          <div key={route.id} className="mb-6 rounded-xl border border-rule bg-white p-4">
            <p className="mb-3 font-medium text-ink">{route.name}</p>

            <div className="mb-4 space-y-2">
              <TripStatusControls
                routeId={route.id}
                tripDate={tripDate}
                direction="morning"
                currentStatus={morning}
              />
              <TripStatusControls
                routeId={route.id}
                tripDate={tripDate}
                direction="afternoon"
                currentStatus={afternoon}
              />
            </div>

            <p className="mb-2 text-sm font-medium text-ink">Riders ({routeRiders.length})</p>
            <div className="space-y-1">
              {routeRiders.map((r, i) => (
                <p key={i} className="text-sm text-ink-soft">
                  {r.student_profiles?.profiles?.full_name ?? "Unknown"}
                  {r.student_profiles?.admission_no
                    ? ` (${r.student_profiles.admission_no})`
                    : ""}{" "}
                  — {r.transport_stops?.name ?? "—"}
                </p>
              ))}
              {!routeRiders.length && <p className="text-sm text-ink-soft">No riders assigned.</p>}
            </div>
          </div>
        );
      })}
      {!routes?.length && (
        <EmptyState message="Your vehicle isn't currently assigned to a route — ask an admin." />
      )}
    </div>
  );
}
