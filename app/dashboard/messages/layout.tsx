import { FeatureGate } from "@/components/FeatureGate";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="messaging">{children}</FeatureGate>;
}
