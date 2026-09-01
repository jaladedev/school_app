"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState message={error.message} onRetryAction={reset} fullScreen />;
}
