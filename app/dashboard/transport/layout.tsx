import { FeatureGate } from "@/components/FeatureGate";

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="transport">{children}</FeatureGate>;
}
