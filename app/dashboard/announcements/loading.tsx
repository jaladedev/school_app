import { SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-2xl">
      <div className="mb-1 h-6 w-40 animate-pulse rounded bg-rule/60" />
      <div className="mb-6 h-4 w-56 animate-pulse rounded bg-rule/60" />
      <SkeletonList count={4} />
    </div>
  );
}