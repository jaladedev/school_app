import { serverEnv } from "@/lib/env.server";
import type { ControlPlaneConfig } from "@/lib/controlPlaneClient";

/** This school's settings for talking to the control plane, or null when not set up. */
export function getControlPlaneConfig(): ControlPlaneConfig | null {
  if (!serverEnv.CONTROL_PLANE_URL || !serverEnv.CLAIM_SIGNING_KEY) return null;
  return {
    baseUrl: serverEnv.CONTROL_PLANE_URL,
    slug: serverEnv.SCHOOL_SLUG,
    privateKey: serverEnv.CLAIM_SIGNING_KEY,
  };
}
