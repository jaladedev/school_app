import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TransportStatusBadge } from "@/components/TransportStatusBadge";
import { RouteMap } from "@/components/RouteMap";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function StudentTransportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const tripDate = todayIso();

  const { data: assignment } = await supabase
    .from("transport_assignments")
    .select("route_id, transport_routes(name), transport_stops(name, approx_time)")
    .eq("student_id", profile.id)
    .is("unassigned_at", null)
    .maybeSingle();

  if (!assignment) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Transport</h1>
        <p className="text-sm text-ink-soft">You aren&apos;t currently assigned to a bus route.</p>
      </div>
    );
  }

  const routeId = assignment.route_id;

  const { data: statuses } = await supabase
    .from("transport_trip_status")
    .select("direction, status")
    .eq("route_id", routeId)
    .eq("trip_date", tripDate);

  const morning = statuses?.find((s) => s.direction === "morning")?.status ?? "not_started";
  const afternoon = statuses?.find((s) => s.direction === "afternoon")?.status ?? "not_started";

  async function latestLocation(direction: "morning" | "afternoon") {
    const { data } = await supabase
      .from("transport_locations")
      .select("lat, lng, recorded_at")
      .eq("route_id", routeId)
      .eq("trip_date", tripDate)
      .eq("direction", direction)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  const morningLocation = morning === "en_route" ? await latestLocation("morning") : null;
  const afternoonLocation = afternoon === "en_route" ? await latestLocation("afternoon") : null;

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {assignment.transport_routes?.name}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Your stop: {assignment.transport_stops?.name}
        {assignment.transport_stops?.approx_time
          ? ` · ~${assignment.transport_stops.approx_time.slice(0, 5)}`
          : ""}
      </p>

      <div className="space-y-3 rounded-xl border border-rule bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">Morning pickup</span>
          <TransportStatusBadge
            routeId={assignment.route_id}
            tripDate={tripDate}
            direction="morning"
            initialStatus={morning as "not_started" | "en_route" | "arrived"}
          />
        </div>
        {morningLocation && (
          <RouteMap
            routeId={assignment.route_id}
            tripDate={tripDate}
            direction="morning"
            initialLat={morningLocation.lat}
            initialLng={morningLocation.lng}
            initialRecordedAt={morningLocation.recorded_at}
            label={assignment.transport_routes?.name ?? "Your bus"}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">Afternoon drop-off</span>
          <TransportStatusBadge
            routeId={assignment.route_id}
            tripDate={tripDate}
            direction="afternoon"
            initialStatus={afternoon as "not_started" | "en_route" | "arrived"}
          />
        </div>
        {afternoonLocation && (
          <RouteMap
            routeId={assignment.route_id}
            tripDate={tripDate}
            direction="afternoon"
            initialLat={afternoonLocation.lat}
            initialLng={afternoonLocation.lng}
            initialRecordedAt={afternoonLocation.recorded_at}
            label={assignment.transport_routes?.name ?? "Your bus"}
          />
        )}
      </div>
    </div>
  );
}
