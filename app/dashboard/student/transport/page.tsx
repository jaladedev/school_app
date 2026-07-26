import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TransportStatusBadge } from "@/components/TransportStatusBadge";

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
        <p className="text-sm text-ink-soft">You aren't currently assigned to a bus route.</p>
      </div>
    );
  }

  const { data: statuses } = await supabase
    .from("transport_trip_status")
    .select("direction, status")
    .eq("route_id", assignment.route_id)
    .eq("trip_date", tripDate);

  const morning = statuses?.find((s) => s.direction === "morning")?.status ?? "not_started";
  const afternoon = statuses?.find((s) => s.direction === "afternoon")?.status ?? "not_started";

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
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">Afternoon drop-off</span>
          <TransportStatusBadge
            routeId={assignment.route_id}
            tripDate={tripDate}
            direction="afternoon"
            initialStatus={afternoon as "not_started" | "en_route" | "arrived"}
          />
        </div>
      </div>
    </div>
  );
}
