import { FeatureGate } from "@/components/FeatureGate";

export default function StudentLibraryLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="library">{children}</FeatureGate>;
}
