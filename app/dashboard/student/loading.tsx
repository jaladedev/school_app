import { SkeletonCardGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-1 h-5 w-24 animate-pulse rounded bg-rule/60" />
      <div className="mb-6 h-4 w-56 animate-pulse rounded bg-rule/60" />
      <SkeletonCardGrid count={6} />
    </div>
  );
}