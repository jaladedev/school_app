import { FeatureGate } from "@/components/FeatureGate";

export default function StudentTransportLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="transport">{children}</FeatureGate>;
}
