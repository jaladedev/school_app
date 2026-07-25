import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateHostelForm } from "@/components/CreateHostelForm";
import { CreateHostelRoomForm } from "@/components/CreateHostelRoomForm";
import { EmptyState } from "@/components/EmptyState";

export default async function HostelsPage() {
  const supabase = createClient();

  const { data: hostels } = await supabase
    .from("hostels")
    .select("id, name, gender, capacity, house_parent_id, teacher_profiles(profiles(full_name))")
    .order("name", { ascending: true });

  const { data: rooms } = await supabase
    .from("hostel_rooms")
    .select("id, hostel_id, room_number, capacity");

  const { data: activeAssignments } = await supabase
    .from("hostel_assignments")
    .select("room_id")
    .is("unassigned_at", null);

  const occupancyByRoom = new Map<string, number>();
  for (const a of activeAssignments ?? []) {
    occupancyByRoom.set(a.room_id, (occupancyByRoom.get(a.room_id) ?? 0) + 1);
  }

  const { data: houseParents } = await supabase
    .from("teacher_profiles")
    .select("id, profiles(full_name)")
    .eq("staff_role", "house_parent");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Hostels</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Boarding houses, rooms, occupancy, and leave logs for boarding students.
      </p>

      <CreateHostelForm
        houseParents={(houseParents ?? []).map((t) => ({
          id: t.id,
          name: t.profiles?.full_name ?? "Unknown",
        }))}
      />

      <div className="mt-6 space-y-4">
        {(hostels ?? []).map((h) => {
          const hostelRooms = (rooms ?? []).filter((r) => r.hostel_id === h.id);
          const totalCapacity = hostelRooms.reduce((sum, r) => sum + r.capacity, 0);
          const totalOccupied = hostelRooms.reduce(
            (sum, r) => sum + (occupancyByRoom.get(r.id) ?? 0),
            0
          );
          return (
            <div key={h.id} className="rounded-xl border border-rule bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{h.name}</p>
                  <p className="text-xs text-ink-soft">
                    {h.gender === "male" ? "Boys" : "Girls"} ·{" "}
                    {h.teacher_profiles?.profiles?.full_name
                      ? `House parent: ${h.teacher_profiles.profiles.full_name}`
                      : "No house parent assigned"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-medium text-leaf">
                  {totalOccupied}/{totalCapacity || h.capacity || "—"} occupied
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {hostelRooms.map((r) => {
                  const occupied = occupancyByRoom.get(r.id) ?? 0;
                  const full = occupied >= r.capacity;
                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/admin/hostels/${h.id}/rooms/${r.id}`}
                      className={`rounded-lg border px-3 py-2 text-center text-sm ${
                        full
                          ? "border-clay/30 bg-clay/5 text-clay"
                          : "border-rule text-ink hover:bg-leaf-soft"
                      }`}
                    >
                      <p className="font-medium">{r.room_number}</p>
                      <p className="text-xs opacity-80">
                        {occupied}/{r.capacity}
                      </p>
                    </Link>
                  );
                })}
                {!hostelRooms.length && (
                  <p className="col-span-full text-sm text-ink-soft">No rooms added yet.</p>
                )}
              </div>

              <div className="mt-3">
                <CreateHostelRoomForm hostelId={h.id} />
              </div>
            </div>
          );
        })}
        {!hostels?.length && <EmptyState message="No hostels yet — add the first one above." />}
      </div>
    </div>
  );
}
