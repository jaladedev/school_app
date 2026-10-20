import { FeatureGate } from "@/components/FeatureGate";

export default function AdminTransportLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="transport">{children}</FeatureGate>;
}
