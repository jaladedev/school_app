# Read-only support sessions

Lets platform support look at a school exactly as its admin sees it, without
being able to change anything, with every page recorded in the school's audit
log.

## How it works

1. The control plane signs a one-time link for one school with that school's
   `IMPERSONATION_SIGNING_SECRET` (`signImpersonationToken` in
   `lib/impersonation.ts`). The link lives at most 10 minutes and works once.
2. The support person opens `https://<school>/api/impersonate?token=<link>`.
   The school checks the signature, the school slug (`SCHOOL_SLUG`) and the
   expiry, records the link id so it cannot be reused, and signs the browser in
   as the school's **Platform support (read-only)** admin account (created on
   first use, visible to the school's admins).
3. The session lasts 30 minutes. A banner shows on every dashboard page.
4. Writes are refused in three places: restrictive policies on every table
   (`apply_readonly_write_gate()`), `assertRole` for service-role writes, and
   `assertNotReadOnly` for the two parent-payment actions that skip `assertRole`.

## What the school can see in `audit_log`

- `impersonation.start`: who from the control plane (`support_user`), the link
  id, and when the session ends.
- `impersonation.view`: the path of each dashboard request.
- `impersonation.ended`: when an expired session was closed.

**Read `view` entries as "opened or prefetched".** Next.js removes its router
headers and the `_rsc` parameter before middleware runs, so a prefetch cannot be
told from a navigation. Nothing is skipped, which means a support person cannot
hide a page by pretending to be a prefetch; the cost is some extra entries.

## After a migration adds a table

Run `select apply_readonly_write_gate();` (and the licence functions in
`deploy/` notes) so the new table gets the read-only policies.

## Not yet tested against a real project

Check these on staging before relying on it:

- `auth.admin.generateLink` (magiclink) followed by `verifyOtp` creates a session.
- GoTrue accepts `platform-support@support.invalid` as an email address. If it
  does not, change `SUPPORT_VIEWER_EMAIL` in `lib/actions/supportViewer.ts`.
- `app_metadata.read_only` appears in the access token, so
  `is_read_only_session()` is true (try an insert as the support user and expect
  a row-level security error).
