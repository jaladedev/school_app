import { FeatureGate } from "@/components/FeatureGate";

export default function AdminLibraryLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="library">{children}</FeatureGate>;
}
