import { SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-1 h-6 w-24 animate-pulse rounded bg-rule/60" />
      <div className="mb-6 h-4 w-40 animate-pulse rounded bg-rule/60" />
      <SkeletonList count={6} />
    </div>
  );
}