import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateVehicleForm } from "@/components/CreateVehicleForm";
import { CreateRouteForm } from "@/components/CreateRouteForm";
import { DriverAccountSection } from "@/components/DriverAccountSection";
import { EmptyState } from "@/components/EmptyState";

export default async function TransportPage() {
  const supabase = createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select(
      "id, plate_number, model, capacity, driver_name, driver_phone, driver_profile_id, profiles(full_name)"
    )
    .eq("is_archived", false)
    .order("plate_number", { ascending: true });

  const { data: existingDrivers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "driver")
    .eq("is_active", true);

  const { data: routes } = await supabase
    .from("transport_routes")
    .select("id, name, description, vehicles(plate_number)")
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

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Transport</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Bus routes, stops, vehicle records, and student assignments.
      </p>

      <div className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Vehicles</h2>
        <CreateVehicleForm />
        <div className="mt-3 space-y-2">
          {(vehicles ?? []).map((v) => (
            <div key={v.id} className="rounded-lg border border-rule bg-white p-3 text-sm">
              <p className="font-medium text-ink">
                {v.plate_number} {v.model ? `· ${v.model}` : ""}
              </p>
              <p className="mb-2 text-xs text-ink-soft">
                Capacity {v.capacity}
                {v.driver_name ? ` · Contact: ${v.driver_name}` : ""}
                {v.driver_phone ? ` (${v.driver_phone})` : ""}
              </p>
              <DriverAccountSection
                vehicleId={v.id}
                currentDriverName={v.profiles?.full_name ?? null}
                existingDrivers={(existingDrivers ?? [])
                  .filter((d) => d.id !== v.driver_profile_id)
                  .map((d) => ({ id: d.id, name: d.full_name }))}
              />
            </div>
          ))}
          {!vehicles?.length && <EmptyState message="No vehicles yet — add the first one above." />}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Routes</h2>
        <CreateRouteForm
          vehicles={(vehicles ?? []).map((v) => ({ id: v.id, label: v.plate_number }))}
        />
        <div className="mt-3 space-y-2">
          {(routes ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/transport/routes/${r.id}`}
              className="flex items-center justify-between rounded-lg border border-rule bg-white p-3 text-sm hover:bg-leaf-soft"
            >
              <div>
                <p className="font-medium text-ink">{r.name}</p>
                <p className="text-xs text-ink-soft">
                  {r.vehicles?.plate_number
                    ? `Vehicle: ${r.vehicles.plate_number}`
                    : "No vehicle assigned"}
                  {" · "}
                  {riderCountByRoute.get(r.id) ?? 0} riders
                </p>
              </div>
              <span className="text-ink-soft">Manage →</span>
            </Link>
          ))}
          {!routes?.length && <EmptyState message="No routes yet — add the first one above." />}
        </div>
      </div>
    </div>
  );
}
