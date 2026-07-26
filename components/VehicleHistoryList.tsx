type HistoryEntry = {
  id: string;
  vehiclePlateNumber: string;
  assignedAt: string;
  unassignedAt: string | null;
};

export function VehicleHistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) {
    return <p className="text-xs text-ink-soft">No vehicle history yet.</p>;
  }

  return (
    <ul className="space-y-1 text-xs text-ink-soft">
      {entries.map((e) => (
        <li key={e.id}>
          {e.vehiclePlateNumber} —{" "}
          {new Date(e.assignedAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" → "}
          {e.unassignedAt
            ? new Date(e.unassignedAt).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "current"}
        </li>
      ))}
    </ul>
  );
}
