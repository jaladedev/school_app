import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { CreateStopForm } from "@/components/CreateStopForm";
import { StopList } from "@/components/StopList";
import { AssignStudentToRouteForm } from "@/components/AssignStudentToRouteForm";
import { RouteOccupants } from "@/components/RouteOccupants";
import { TripStatusControls } from "@/components/TripStatusControls";
import { ReassignVehicleForm } from "@/components/ReassignVehicleForm";
import { VehicleHistoryList } from "@/components/VehicleHistoryList";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TransportRoutePage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const supabase = createClient();
  const tripDate = todayIso();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  let canManage = profile.role === "admin";
  if (!canManage) {
    const { data: teacherProfile } = await supabase
      .from("teacher_profiles")
      .select("staff_role")
      .eq("id", profile.id)
      .maybeSingle();
    canManage = teacherProfile?.staff_role === "transport_officer";
  }
  if (!canManage) redirect(`/dashboard/${profile.role}`);

  const backHref = profile.role === "admin" ? "/dashboard/admin/transport" : "/dashboard/transport";

  const { data: route } = await supabase
    .from("transport_routes")
    .select("id, name, description, vehicle_id, vehicles(plate_number, driver_name)")
    .eq("id", routeId)
    .single();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, plate_number, capacity")
    .eq("is_archived", false)
    .order("plate_number", { ascending: true });

  const { data: vehicleHistory } = await supabase
    .from("route_vehicle_history")
    .select("id, assigned_at, unassigned_at, vehicles(plate_number)")
    .eq("route_id", routeId)
    .order("assigned_at", { ascending: false });

  const { data: stops } = await supabase
    .from("transport_stops")
    .select("id, name, sequence_order, approx_time")
    .eq("route_id", routeId)
    .order("sequence_order", { ascending: true });

  const { data: assignments } = await supabase
    .from("transport_assignments")
    .select(
      "id, student_id, stop_id, student_profiles(admission_no, profiles(full_name)), transport_stops(name)"
    )
    .eq("route_id", routeId)
    .is("unassigned_at", null);

  const assignedStudentIds = (assignments ?? []).map((a) => a.student_id);

  const { data: allStudents } = await supabase
    .from("student_profiles")
    .select("id, admission_no, profiles(full_name)")
    .order("admission_no", { ascending: true });

  const studentOptions = (allStudents ?? [])
    .filter((s) => !assignedStudentIds.includes(s.id))
    .map((s) => ({
      id: s.id,
      label: `${s.profiles?.full_name ?? "Unknown"}${s.admission_no ? ` (${s.admission_no})` : ""}`,
    }));

  const { data: tripStatuses } = await supabase
    .from("transport_trip_status")
    .select("direction, status")
    .eq("route_id", routeId)
    .eq("trip_date", tripDate);

  const statusByDirection = new Map((tripStatuses ?? []).map((t) => [t.direction, t.status]));

  if (!route) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Route not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={backHref}
        className="mb-4 inline-block text-sm text-leaf hover:underline"
      >
        ← Back to transport
      </Link>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{route.name}</h1>

      <div className="mb-6 space-y-2 rounded-xl border border-rule bg-white p-4">
        <p className="text-sm font-medium text-ink">Vehicle</p>
        <ReassignVehicleForm
          routeId={routeId}
          currentVehicleId={route.vehicle_id}
          vehicles={(vehicles ?? []).map((v) => ({
            id: v.id,
            label: `${v.plate_number} (${v.capacity} seats)`,
          }))}
        />
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-soft">History</summary>
          <div className="mt-2">
            <VehicleHistoryList
              entries={(vehicleHistory ?? []).map((h) => ({
                id: h.id,
                vehiclePlateNumber: h.vehicles?.plate_number ?? "Unknown",
                assignedAt: h.assigned_at,
                unassignedAt: h.unassigned_at,
              }))}
            />
          </div>
        </details>
      </div>

      <div className="mb-6 space-y-2 rounded-xl border border-rule bg-white p-4">
        <p className="text-sm font-medium text-ink">Today's status</p>
        <TripStatusControls
          routeId={routeId}
          tripDate={tripDate}
          direction="morning"
          currentStatus={statusByDirection.get("morning") ?? "not_started"}
        />
        <TripStatusControls
          routeId={routeId}
          tripDate={tripDate}
          direction="afternoon"
          currentStatus={statusByDirection.get("afternoon") ?? "not_started"}
        />
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Stops</h2>
        <div className="mb-3">
          <StopList stops={stops ?? []} />
        </div>
        <CreateStopForm routeId={routeId} nextSequence={(stops?.length ?? 0) + 1} />
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Assign a student</h2>
        <AssignStudentToRouteForm
          routeId={routeId}
          stops={(stops ?? []).map((s) => ({ id: s.id, label: s.name }))}
          students={studentOptions}
        />
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Riders</h2>
        <RouteOccupants
          occupants={(assignments ?? []).map((a) => ({
            id: a.id,
            fullName: a.student_profiles?.profiles?.full_name ?? "Unknown",
            admissionNo: a.student_profiles?.admission_no ?? null,
            stopName: a.transport_stops?.name ?? "—",
          }))}
        />
        {!assignments?.length && <p className="text-sm text-ink-soft">No riders assigned yet.</p>}
      </div>
    </div>
  );
}