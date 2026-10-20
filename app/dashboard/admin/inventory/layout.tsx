import { FeatureGate } from "@/components/FeatureGate";

export default function AdminInventoryLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="inventory">{children}</FeatureGate>;
}
