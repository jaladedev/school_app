import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TransportStatusBadge } from "@/components/TransportStatusBadge";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ParentTransportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const tripDate = todayIso();

  const { data: links } = await supabase
    .from("guardian_links")
    .select("student_id, student_profiles(profiles(full_name))")
    .eq("parent_id", profile.id);

  const children = links ?? [];

  const assignmentsByStudent = new Map<
    string,
    {
      route_id: string;
      route_name: string | null;
      stop_name: string | null;
      approx_time: string | null;
    }
  >();

  await Promise.all(
    children.map(async (c) => {
      const { data: assignment } = await supabase
        .from("transport_assignments")
        .select("route_id, transport_routes(name), transport_stops(name, approx_time)")
        .eq("student_id", c.student_id)
        .is("unassigned_at", null)
        .maybeSingle();
      if (assignment) {
        assignmentsByStudent.set(c.student_id, {
          route_id: assignment.route_id,
          route_name: assignment.transport_routes?.name ?? null,
          stop_name: assignment.transport_stops?.name ?? null,
          approx_time: assignment.transport_stops?.approx_time ?? null,
        });
      }
    })
  );

  const routeIds = [...new Set([...assignmentsByStudent.values()].map((a) => a.route_id))];

  const { data: statuses } = routeIds.length
    ? await supabase
        .from("transport_trip_status")
        .select("route_id, direction, status")
        .in("route_id", routeIds)
        .eq("trip_date", tripDate)
    : { data: [] };

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Transport</h1>
      <p className="mb-6 text-sm text-ink-soft">Bus status for each of your children.</p>

      <div className="space-y-3">
        {children.map((c) => {
          const assignment = assignmentsByStudent.get(c.student_id);
          const fullName = c.student_profiles?.profiles?.full_name ?? "Child";

          if (!assignment) {
            return (
              <div key={c.student_id} className="rounded-xl border border-rule bg-white p-4">
                <p className="font-medium text-ink">{fullName}</p>
                <p className="text-sm text-ink-soft">Not currently assigned to a bus route.</p>
              </div>
            );
          }

          const morning =
            statuses?.find((s) => s.route_id === assignment.route_id && s.direction === "morning")
              ?.status ?? "not_started";
          const afternoon =
            statuses?.find((s) => s.route_id === assignment.route_id && s.direction === "afternoon")
              ?.status ?? "not_started";

          return (
            <div key={c.student_id} className="rounded-xl border border-rule bg-white p-4">
              <p className="font-medium text-ink">{fullName}</p>
              <p className="mb-3 text-xs text-ink-soft">
                {assignment.route_name} · Stop: {assignment.stop_name}
                {assignment.approx_time ? ` · ~${assignment.approx_time.slice(0, 5)}` : ""}
              </p>
              <div className="space-y-2">
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
        })}
        {!children.length && <p className="text-sm text-ink-soft">No linked children found.</p>}
      </div>
    </div>
  );
}
