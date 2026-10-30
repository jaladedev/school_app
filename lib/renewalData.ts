import { getControlPlaneConfig } from "@/lib/controlPlaneConfig";
import { ControlPlaneError, fetchOpenInvoices, type OpenInvoices } from "@/lib/controlPlaneClient";
import { logger } from "@/lib/logger";

export type RenewalData =
  | { state: "not_set_up" }
  | { state: "unavailable"; message: string }
  | { state: "ready"; data: OpenInvoices };

/**
 * What the renewal screen shows: the invoices the control plane has open for this
 * school. A billing server that is down never breaks the page, it just says so.
 */
export async function loadRenewalData(): Promise<RenewalData> {
  const cfg = getControlPlaneConfig();
  if (!cfg) return { state: "not_set_up" };
  try {
    return { state: "ready", data: await fetchOpenInvoices(cfg) };
  } catch (err) {
    logger.error("loadRenewalData: could not read open invoices", { error: err });
    return {
      state: "unavailable",
      message:
        err instanceof ControlPlaneError
          ? err.message
          : "The billing server is not responding. Try again in a moment.",
    };
  }
}
