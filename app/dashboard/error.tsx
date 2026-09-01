"use client";

import { ErrorState } from "@/components/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState message={error.message} onRetryAction={reset} retryHref="/dashboard" />;
}
