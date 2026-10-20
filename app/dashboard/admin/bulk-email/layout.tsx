import { FeatureGate } from "@/components/FeatureGate";

export default function AdminBulkEmailLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="bulk_email">{children}</FeatureGate>;
}
