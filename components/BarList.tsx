/**
 * Lightweight, dependency-free horizontal bar visualization. The project
 * has no charting library installed — pulling one in for a handful of
 * admin-only bar charts wasn't worth the bundle-size cost, especially
 * given the bandwidth-conscious audience noted elsewhere in this app.
 * Plain proportional-width divs cover every chart this dashboard needs.
 */
export function BarList({
  items,
  colorClassName = "bg-leaf",
}: {
  items: { label: string; value: number; displayValue: string }[];
  colorClassName?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-soft">{item.label}</span>
            <span className="shrink-0 font-medium text-ink">{item.displayValue}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
            <div
              className={`h-full rounded-full ${colorClassName}`}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
