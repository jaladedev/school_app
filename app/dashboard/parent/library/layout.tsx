import { FeatureGate } from "@/components/FeatureGate";

export default function ParentLibraryLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="library">{children}</FeatureGate>;
}
