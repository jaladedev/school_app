"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  unassignStudentFromRoom,
  logHostelLeave,
  recordHostelReturn,
  logHostelVisitorCheckIn,
  recordHostelVisitorCheckOut,
} from "@/lib/actions/hostel";
import { emitToast } from "@/lib/toast";

type Occupant = { id: string; studentId: string; fullName: string; admissionNo: string | null };
type OpenLeave = {
  id: string;
  studentId: string;
  reason: string | null;
  outAt: string;
  expectedReturnAt: string | null;
};
type OpenVisitor = {
  id: string;
  studentId: string;
  visitorName: string;
  purpose: string | null;
  checkedInAt: string;
};

export function RoomOccupants({
  roomId,
  assignments,
  openLeaveLogs,
  openVisitorLogs,
}: {
  roomId: string;
  assignments: Occupant[];
  openLeaveLogs: OpenLeave[];
  openVisitorLogs: OpenVisitor[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaveFormFor, setLeaveFormFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [visitorFormFor, setVisitorFormFor] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorPurpose, setVisitorPurpose] = useState("");

  function unassign(assignmentId: string) {
    startTransition(async () => {
      try {
        await unassignStudentFromRoom(assignmentId, roomId);
        emitToast("Student unassigned.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function submitLeave(studentId: string) {
    startTransition(async () => {
      try {
        await logHostelLeave({
          studentId,
          reason: reason || undefined,
          expectedReturnAt: expectedReturn || undefined,
        });
        emitToast("Leave logged.");
        setLeaveFormFor(null);
        setReason("");
        setExpectedReturn("");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function markReturned(leaveLogId: string, studentId: string) {
    startTransition(async () => {
      try {
        await recordHostelReturn(leaveLogId, studentId);
        emitToast("Return recorded.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function submitVisitor(studentId: string) {
    startTransition(async () => {
      try {
        await logHostelVisitorCheckIn({
          studentId,
          visitorName,
          visitorPhone: visitorPhone || undefined,
          purpose: visitorPurpose || undefined,
        });
        emitToast("Visitor checked in.");
        setVisitorFormFor(null);
        setVisitorName("");
        setVisitorPhone("");
        setVisitorPurpose("");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  function checkOutVisitor(visitorLogId: string, studentId: string) {
    startTransition(async () => {
      try {
        await recordHostelVisitorCheckOut(visitorLogId, studentId);
        emitToast("Visitor checked out.");
        router.refresh();
      } catch (err) {
        emitToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="space-y-2">
      {assignments.map((occ) => {
        const openLeave = openLeaveLogs.find((l) => l.studentId === occ.studentId);
        const openVisitor = openVisitorLogs.find((v) => v.studentId === occ.studentId);
        return (
          <div key={occ.id} className="rounded-lg border border-rule bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{occ.fullName}</p>
                {occ.admissionNo && <p className="text-xs text-ink-soft">{occ.admissionNo}</p>}
              </div>
              <div className="flex items-center gap-2">
                {openLeave ? (
                  <>
                    <span className="rounded-full bg-marigold-soft px-2 py-0.5 text-xs font-medium text-ink">
                      Out{openLeave.expectedReturnAt ? " — back by scheduled time" : ""}
                    </span>
                    <button
                      onClick={() => markReturned(openLeave.id, occ.studentId)}
                      disabled={isPending}
                      className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft disabled:opacity-60"
                    >
                      Mark returned
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setLeaveFormFor(leaveFormFor === occ.studentId ? null : occ.studentId)
                    }
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
                  >
                    Log leave
                  </button>
                )}
                {openVisitor ? (
                  <>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-ink">
                      Visitor: {openVisitor.visitorName}
                    </span>
                    <button
                      onClick={() => checkOutVisitor(openVisitor.id, occ.studentId)}
                      disabled={isPending}
                      className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft disabled:opacity-60"
                    >
                      Check out visitor
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setVisitorFormFor(visitorFormFor === occ.studentId ? null : occ.studentId)
                    }
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
                  >
                    Log visitor
                  </button>
                )}
                <button
                  onClick={() => unassign(occ.id)}
                  disabled={isPending}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper disabled:opacity-60"
                >
                  Unassign
                </button>
              </div>
            </div>

            {openLeave?.reason && (
              <p className="mt-1 text-xs text-ink-soft">Reason: {openLeave.reason}</p>
            )}
            {openVisitor?.purpose && (
              <p className="mt-1 text-xs text-ink-soft">Visiting for: {openVisitor.purpose}</p>
            )}

            {leaveFormFor === occ.studentId && (
              <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-rule pt-3">
                <input
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
                />
                <input
                  type="datetime-local"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  className="rounded-lg border border-rule px-3 py-2 text-sm"
                />
                <button
                  onClick={() => submitLeave(occ.studentId)}
                  disabled={isPending}
                  className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
                >
                  {isPending ? "Logging…" : "Log leave"}
                </button>
              </div>
            )}

            {visitorFormFor === occ.studentId && (
              <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-rule pt-3">
                <input
                  placeholder="Visitor name"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
                />
                <input
                  placeholder="Phone (optional)"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  className="rounded-lg border border-rule px-3 py-2 text-sm"
                />
                <input
                  placeholder="Purpose (optional)"
                  value={visitorPurpose}
                  onChange={(e) => setVisitorPurpose(e.target.value)}
                  className="rounded-lg border border-rule px-3 py-2 text-sm"
                />
                <button
                  onClick={() => submitVisitor(occ.studentId)}
                  disabled={isPending || !visitorName.trim()}
                  className="rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-60"
                >
                  {isPending ? "Checking in…" : "Check in visitor"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
