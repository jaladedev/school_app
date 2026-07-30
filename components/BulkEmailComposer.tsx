"use client";

import { useEffect, useState, useTransition } from "react";
import {
  countBulkEmailRecipients,
  sendBulkEmailToAudience,
  type BulkEmailAudience,
  type BulkEmailAudienceRole,
} from "@/lib/actions/bulkEmail";

const ROLE_OPTIONS: { value: BulkEmailAudienceRole; label: string }[] = [
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents / guardians" },
  { value: "teacher", label: "Teachers & staff" },
  { value: "admin", label: "Admins" },
];

export function BulkEmailComposer({
  classOptions,
}: {
  classOptions: { id: string; label: string }[];
}) {
  const [roles, setRoles] = useState<BulkEmailAudienceRole[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [count, setCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [isSending, startSending] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const audience: BulkEmailAudience = {
    roles,
    classId: classId || null,
  };

  // Live recipient count, debounced so it doesn't fire on every keystroke
  // of an unrelated field (only roles/classId affect the count anyway,
  // but this effect only depends on those two).
  useEffect(() => {
    setSendResult(null);
    if (roles.length === 0) {
      setCount(null);
      setCountError(null);
      return;
    }
    setIsCounting(true);
    const timeout = setTimeout(() => {
      countBulkEmailRecipients(audience)
        .then((n) => {
          setCount(n);
          setCountError(null);
        })
        .catch((err) => setCountError(err.message ?? "Couldn't count recipients."))
        .finally(() => setIsCounting(false));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(","), classId]);

  function toggleRole(role: BulkEmailAudienceRole) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
    setConfirming(false);
  }

  function handleReviewClick() {
    setSendError(null);
    if (!subject.trim()) {
      setSendError("Enter a subject.");
      return;
    }
    if (!body.trim()) {
      setSendError("Enter a message.");
      return;
    }
    if (roles.length === 0) {
      setSendError("Select at least one recipient group.");
      return;
    }
    setConfirming(true);
  }

  function handleConfirmSend() {
    setSendError(null);
    startSending(async () => {
      try {
        const result = await sendBulkEmailToAudience({ audience, subject, body });
        setSendResult({ sent: result.sent, failed: result.failed });
        setConfirming(false);
      } catch (err: any) {
        setSendError(err.message ?? "Something went wrong.");
        setConfirming(false);
      }
    });
  }

  const appliesClassFilter = roles.includes("student") || roles.includes("parent");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Send to</p>
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                roles.includes(opt.value)
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft"
              }`}
            >
              <input
                type="checkbox"
                checked={roles.includes(opt.value)}
                onChange={() => toggleRole(opt.value)}
                className="rounded border-rule"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">
          Limit to a class{" "}
          <span className="font-normal text-ink-soft">(only affects Students / Parents above)</span>
        </label>
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setConfirming(false);
          }}
          disabled={!appliesClassFilter}
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">All classes</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft">
        {roles.length === 0 &&
          "Select at least one recipient group to see how many people this reaches."}
        {roles.length > 0 && isCounting && "Counting recipients…"}
        {roles.length > 0 && !isCounting && countError && (
          <span className="text-clay">{countError}</span>
        )}
        {roles.length > 0 && !isCounting && !countError && count !== null && (
          <>
            This will email <strong className="text-ink">{count}</strong>{" "}
            {count === 1 ? "person" : "people"} (only those with an email on file).
          </>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">Subject</label>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setConfirming(false);
          }}
          placeholder="e.g. Reminder: Term 2 resumes Monday"
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">Message</label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirming(false);
          }}
          rows={8}
          placeholder="Plain text — no formatting needed, this isn't a rich-text editor."
          className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
        />
      </div>

      {sendError && <p className="text-sm text-clay">{sendError}</p>}

      {sendResult && (
        <div className="rounded-lg bg-leaf-soft px-3 py-2 text-sm text-leaf">
          Sent to {sendResult.sent} {sendResult.sent === 1 ? "person" : "people"}.
          {sendResult.failed > 0 && (
            <span className="text-clay"> {sendResult.failed} failed to send.</span>
          )}
        </div>
      )}

      {!confirming ? (
        <button
          onClick={handleReviewClick}
          className="rounded-lg bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf/90"
        >
          Review &amp; send
        </button>
      ) : (
        <div className="rounded-lg border border-marigold/40 bg-marigold/10 p-4">
          <p className="mb-3 text-sm text-ink">
            You&apos;re about to email{" "}
            <strong>
              {count ?? "…"} {count === 1 ? "person" : "people"}
            </strong>
            . This can&apos;t be undone once sent. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmSend}
              disabled={isSending}
              className="rounded-lg bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay/90 disabled:opacity-60"
            >
              {isSending ? "Sending…" : `Yes, send to ${count ?? "…"} people`}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isSending}
              className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
