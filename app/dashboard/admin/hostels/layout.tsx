import { FeatureGate } from "@/components/FeatureGate";

export default function AdminHostelsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="hostel">{children}</FeatureGate>;
}
