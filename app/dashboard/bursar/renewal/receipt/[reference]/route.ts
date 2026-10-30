import { NextResponse } from "next/server";
import { assertCanManageFees } from "@/lib/actions/fees";
import { getControlPlaneConfig } from "@/lib/controlPlaneConfig";
import { ControlPlaneError, fetchReceiptPdf } from "@/lib/controlPlaneClient";
import { logger } from "@/lib/logger";

// Downloads one receipt for this school's licence payments. For an admin or the
// bursar. It is a read, so it also works in a read-only support session, and it works
// when the licence has lapsed.
export const dynamic = "force-dynamic";

const plain = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    await assertCanManageFees("Only an admin or the bursar can download receipts.", {
      allowWhenExpired: true,
      allowWhenReadOnly: true,
    });
  } catch (err) {
    return plain(err instanceof Error ? err.message : "Not allowed.", 403);
  }
  const { reference } = await params;
  if (!/^SUB-[0-9A-F]{8}$/.test(reference)) return plain("That is not an invoice.", 404);
  const cfg = getControlPlaneConfig();
  if (!cfg) return plain("Online renewal is not set up for this school yet.", 503);
  try {
    const pdf = await fetchReceiptPdf(cfg, reference);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Receipt-${reference.slice(4)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ControlPlaneError) return plain(err.message, err.status === 404 ? 404 : 502);
    logger.error("receipt download failed", { error: err });
    return plain("The receipt could not be downloaded.", 500);
  }
}
