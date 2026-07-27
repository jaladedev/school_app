import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TripStatusControls } from "@/components/TripStatusControls";
import { LiveLocationSender } from "@/components/LiveLocationSender";
import { EmptyState } from "@/components/EmptyState";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const tripDate = todayIso();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, plate_number, model")
    .eq("driver_profile_id", profile.id)
    .eq("is_archived", false)
    .maybeSingle();

  if (!vehicle) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My route</h1>
        <EmptyState message="No vehicle is currently linked to your account — ask an admin to link one." />
      </div>
    );
  }

  const { data: route } = await supabase
    .from("transport_routes")
    .select("id, name, description")
    .eq("vehicle_id", vehicle.id)
    .eq("is_archived", false)
    .maybeSingle();

  if (!route) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My route</h1>
        <p className="mb-4 text-sm text-ink-soft">
          {vehicle.plate_number} {vehicle.model ? `· ${vehicle.model}` : ""}
        </p>
        <EmptyState message="This vehicle isn't currently assigned to a route." />
      </div>
    );
  }

  const { data: stops } = await supabase
    .from("transport_stops")
    .select("id, name, approx_time")
    .eq("route_id", route.id)
    .order("sequence_order", { ascending: true });

  const { data: statuses } = await supabase
    .from("transport_trip_status")
    .select("direction, status")
    .eq("route_id", route.id)
    .eq("trip_date", tripDate);

  const morningStatus = statuses?.find((s) => s.direction === "morning")?.status ?? "not_started";
  const afternoonStatus =
    statuses?.find((s) => s.direction === "afternoon")?.status ?? "not_started";

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{route.name}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {vehicle.plate_number} {vehicle.model ? `· ${vehicle.model}` : ""}
        {route.description ? ` · ${route.description}` : ""}
      </p>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Stops</h2>
        <div className="space-y-1.5">
          {(stops ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-3 py-2 text-sm"
            >
              <span className="text-ink">{s.name}</span>
              {s.approx_time && (
                <span className="text-xs text-ink-soft">{s.approx_time.slice(0, 5)}</span>
              )}
            </div>
          ))}
          {!stops?.length && <EmptyState message="No stops added for this route yet." />}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-rule bg-white p-4">
        <p className="text-sm font-medium text-ink">Today&apos;s trip</p>
        <TripStatusControls
          routeId={route.id}
          tripDate={tripDate}
          direction="morning"
          currentStatus={morningStatus as "not_started" | "en_route" | "arrived"}
        />
        <LiveLocationSender routeId={route.id} tripDate={tripDate} direction="morning" />
        <TripStatusControls
          routeId={route.id}
          tripDate={tripDate}
          direction="afternoon"
          currentStatus={afternoonStatus as "not_started" | "en_route" | "arrived"}
        />
        <LiveLocationSender routeId={route.id} tripDate={tripDate} direction="afternoon" />
      </div>
    </div>
  );
}
