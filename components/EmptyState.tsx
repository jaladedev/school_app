import Link from "next/link";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-white px-4 py-8 text-center">
      <p className="text-sm text-ink-soft">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-block rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
