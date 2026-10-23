# school_app: open items (as of 22 Oct 2026)

## Ship what is built (nothing below is committed or deployed yet)

- [ ] Apply `school_app_ci_sql_r2.zip` (or `ci-sql-r2.patch`), run `npm install` to refresh the lockfile, commit.
- [ ] First push: watch the new CI jobs. The `docker-smoke` and `publish-image` steps have never run on GitHub; only the local standalone version of the smoke test has (23/23).
- [x] Fix `format:check`: `load-test/k6-pages.js` and `load-test/k6-realtime-ramp.js` fail `prettier --check` (from the last pulled commit; run `prettier --write` on them).
- [ ] Set the new required variables in every school's env file: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SCHOOL_SLUG`, `IMPERSONATION_SIGNING_SECRET` (`openssl rand -hex 32`). The app will not start without them, including the current staging deploy.

## Licensing

- [ ] Seed a trial licence row on the live `school` project with `set_license` (needs: trial length, grace days, student cap, add-ons). No row exists, so nothing is restricted yet.
- [ ] After any migration that adds a table: re-run `apply_license_feature_gate()`, `apply_license_rpc_guards()` and `apply_readonly_write_gate()`.
- [ ] Bulk email is enforced in the app only; `send_fee_reminders` is treated as core fee work.
- [ ] Confirm the active-student count definition (active students in non-archived classes).

## Files on R2

- [ ] Rehearse `deploy/r2-migration.md` on a scratch bucket, then move the staging school's files (rclone copy, compare counts and sizes, switch, copy again to catch uploads made during the cut-over).
- [ ] Test R2 against a real bucket: upload, delete, signed links opening in the browser, and `next/image` loading a signed student photo (host pattern `**.r2.cloudflarestorage.com`).
- [ ] Delete the old Supabase Storage buckets only after the retention period.

## Read-only support sessions (migration is live on `school`; app code is not)

- [ ] On staging, check that `generateLink` (magiclink) plus `verifyOtp` creates a session.
- [ ] Check GoTrue accepts `platform-support@support.invalid`; if not, change `SUPPORT_VIEWER_EMAIL` in `lib/actions/supportViewer.ts`.
- [ ] Check `app_metadata.read_only` reaches the access token: as the support user, an insert should fail with a row-level security error.
- [ ] Decide: should the school's admins be able to deactivate the support account? Today it is reactivated on every session.
- [x] The login page now shows a message for `?reason=support-session-ended` (and `deactivated`).
- [ ] Audit `view` entries mean "opened or prefetched" (Next.js hides prefetch signals from middleware); decide whether that wording needs to reach the schools.
- [ ] Control plane: build link signing with `lib/impersonation.ts` (`signImpersonationToken`).

## Containers and deploy

- [ ] `/api/health` is shallow (config only). Consider a deep check (database reachable, `school_license` present) and reporting `SCHOOL_SLUG` so a mismatched env file is caught.
- [ ] Make the new CI jobs (`sql-tests`, `docker-smoke`) required checks on `main`.
- [ ] `TELEGRAM_BOT_TOKEN` is still a planned, unvalidated variable.

## Later (from the plan)

- [ ] Control-plane dashboard.
