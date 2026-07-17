"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { error: updateAuthError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateAuthError) {
      setLoading(false);
      setError(updateAuthError.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);

      if (profileError) {
        setLoading(false);
        setError(profileError.message);
        return;
      }
    }

    // Important: the custom access token hook (if enabled) bakes
    // must_change_password into the JWT at issuance time. The token the
    // browser is still holding was issued *before* the update above, so
    // it still says `true`. Force a refresh here so the new token picks
    // up the updated claim immediately — otherwise the middleware would
    // read the stale claim and bounce the user right back to this page.
    await supabase.auth.refreshSession();

    // The temporary password may have been used to sign in elsewhere
    // (or by whoever set it up, before handing it off). Revoking every
    // other session forces anyone still on the old password to sign in
    // again with the one just chosen here.
    await supabase.auth.signOut({ scope: "others" });

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper bg-notebook-lines px-4">
      <div className="w-full max-w-sm rounded-2xl border border-rule bg-paper p-8 shadow-sm">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Set a new password</h1>
        <p className="mb-6 text-sm text-ink-soft">
          For security, you need to choose your own password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ink">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-ink outline-none focus-visible:border-marigold"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-ink">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-rule bg-white px-3 py-2 text-ink outline-none focus-visible:border-marigold"
              placeholder="Re-enter your new password"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-clay">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-marigold px-4 py-2 font-medium text-ink transition hover:bg-marigold-dark disabled:opacity-60"
          >
            {loading ? "Saving…" : "Set password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
