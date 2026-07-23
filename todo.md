# School Management App — Complete Todo List

> Consolidated from the entire build. [x] = done, [~] = partially done, [ ] = not started.

---

## Foundation

- [x] Next.js + Supabase project scaffold (App Router, Tailwind, TypeScript)
- [x] Design system — notebook/paper theme (marigold/leaf/ink tokens), Baloo 2 + Inter typography
- [x] Full database schema — users/roles, classes, timetables, lessons, attendance, curriculum notes, grades, messaging, admin
- [x] Nigerian education system — Primary/JSS/SSS with `education_level` + `level_number`, replacing a generic flat grade scale
- [x] Full subject list seeded across Primary, JSS, SS (NERDC-based)
- [x] Curriculum content authored — Primary 4 Basic Science and Technology, all 3 terms, 18 topics, with tables and Mermaid diagrams
- [x] `types/database.ts` — hand-maintained with literal `Relationships` FK metadata per table (not `supabase gen types`, but structurally equivalent)

---

## Auth and Accounts

- [x] Login page
- [x] Admin-created accounts only — no public signup (reconciled from an earlier self-signup approach)
- [x] Force password change on first login — `must_change_password` flag + JWT custom claims hook (with session-refresh fix for the claim-staleness edge case)
- [x] Reset password action (admin-triggered, forces change again)
- [x] Deactivation — real Supabase Auth `ban_duration`, not just a UI flag, for teachers, students, and parents
- [x] Logout button
- [ ] Rate limiting on `/login` and account creation actions
- [x] Friendly pre-check for email-uniqueness before account creation (`assertEmailAvailable()` in `lib/actions/admin.ts` now surfaces a clear duplicate-email error before the Auth create call)
- [ ] Invalidate other sessions when a password is reset/changed
- [~] `assertIsAdmin()` hardening — current pattern (session-checked role, service-role action) is reasonable as-is; deeper re-verification per action not done
- [ ] **`generateTempPassword()` has weak entropy** — 8-word list × 2 slots × 2-digit number ≈ 5,760 possible combinations, brute-forceable for real production logins. Widen the wordlist substantially or switch to a `crypto`-based random generator.
- [ ] **Orphaned-auth-user cleanup path** — `createTeacherAccount` / `createStudentAccount` / `createStudentsBulk` create the Supabase Auth user first, then insert profile rows, calling `deleteUser` to compensate on failure. If that compensating `deleteUser` call itself fails (network blip, etc.), an auth user with no profile is left behind with no cleanup job to catch it. Needs either a Postgres function that does everything in one transaction, or a periodic job that finds/removes orphaned auth users.

---

## Classes, Subjects, Timetables

- [x] Create/edit class, archive instead of delete (with dedicated archived-classes list + unarchive)
- [x] Class teacher assignment
- [x] Create subject (admin UI, stage + level range)
- [x] Timetable builder with conflict checking — client-side pre-check AND a real DB-level trigger (`check_timetable_conflict()`) as backstop
- [x] Promotion workflow — promote/repeat/graduate, writes real enrollment history
- [~] Timetable grid is weekday-columns-with-list, not a true row×column grid table
- [ ] Copy timetable from previous term/year
- [ ] Timetable PDF export
- [ ] Admin-facing teacher conflict view
- [ ] `timetable_entries.period_number > 0` check constraint — **done** (added along with the DB trigger)
- [~] Enrollment unique index — current constraint is `(student_id, class_id, academic_year, term)`; whether that's the right shape for the promotion model wasn't revisited
- [ ] **`promoteStudents` / `createStudentsBulk` loop row-by-row with sequential `await`s** — fine at current scale, but N round trips instead of a batched write will get slow with large class lists.

---

## Students Module

- [x] Create student (single form + bulk via paste-text or CSV file upload)
- [x] Edit student (name, class, admission no., guardian info)
- [x] Student detail page with 5 tabs (Info/Attendance/Grades/Notes/Report Card)
- [x] CSV export (full list, not just current page) and CSV file import
- [x] Server-side search (name/email/admission no.) + pagination (25/page)
- [x] Reset password, deactivate/reactivate
- [ ] Student photo upload
- [x] Email editing — deliberately excluded; changing it requires syncing Auth + profile, and the app intentionally leaves that workflow as a recreate-only operation rather than a partial implementation

---

## Staff Module

- [x] Create teacher, assign subjects, edit name
- [x] Reset password, deactivate/reactivate
- [x] Server-side search (name/email)
- [x] `EditTeacherSubjectsForm` shows subject names, not raw IDs
- [ ] Pagination on staff page (students/invoices/payments got it; staff didn't)
- [ ] Teacher profile page (workload hours, classes overview beyond the home page)
- [ ] Staff sub-roles (HOD, bursar)

---

## Teacher Experience

- [x] Create lesson from a timetable slot (topic picker scoped to class level, objectives, homework)
- [x] Mark attendance (bulk "mark all present," teacher-scoped via `lessons.teacher_id`)
- [x] Create assessments — "standard set" (1st CA 20 / 2nd CA 20 / Exam 60) in one click, or custom
- [x] Enter grades — remark field + quick-select comment bank, teacher-scoped to their actual `timetable_entries` assignment
- [x] Author curriculum notes (draft/published workflow)
- [x] Homework feed (given/reviewed status toggle)
- [ ] Homework "mark as graded" beyond the given/reviewed binary
- [ ] Attendance history chart, "copy from last lesson," export register
- [ ] Grade moderation is admin-only — no HOD-level intermediate approval step
- [ ] CSV grade import
- [ ] Assessment "type" as a real enum (currently free-text titles)
- [x] `weight_percent` — now used in report-card scoring (`lib/report-card.ts` reads `weight_percent` and applies the weighted-average path when available)
- [ ] Curriculum notes: file/image/video upload wiring (Storage bucket), version history, `pdf`/`audio` resource-type rendering in `TopicContent`

---

## Grades and Report Cards

- [x] Full ranking/averaging engine — subject percentages, class rank (competition ranking with ties), overall average and position
- [x] Letter grades via configurable `grade_scale` in School Settings
- [x] Printable report card (print-to-PDF pattern, no library dependency)
- [x] Class teacher + admin remarks per term
- [x] **Grade moderation** — grades default `pending`, admin approves per-assessment before students can see them; report cards only count `approved` grades
- [x] **Critical bug fixed**: report-card ranking was silently computing "1st of 1" for every student — RLS only ever returned a student's own grades when queried through their session, so classmates' scores for ranking were invisibly missing the entire time. Fixed by using the admin client for that specific cross-student read (safe since calling pages control whose report is generated).
- [ ] Report card school logo / signature lines / stamp area for printing

---

## Fees Module

- [x] Core schema — `fee_structures`, `invoices`, `payments`, all money as integer kobo
- [x] Admin: create fee structure, generate invoices per class (idempotent), record manual payments (cash/bank transfer/card/other)
- [x] **Paystack integration** — inline popup, but the client "success" callback is a UI cue only; `verifyPaystackPayment` re-checks the transaction server-side against Paystack's API (secret key, never exposed) before crediting anything, with reference-based idempotency
- [x] Student + parent fee views, balance, payment history
- [x] Receipts — shared printable route (`/dashboard/fees/receipt/[paymentId]`), works for both roles via RLS
- [x] Defaulters export to CSV
- [x] Discount/scholarship support (`discount_kobo` per invoice)
- [x] **Bug fixed mid-build**: `verifyPaystackPayment`'s authorization only checked "is this the invoice's own student or admin" — which would have silently rejected a parent trying to pay for their child. Patched to also check `guardian_links`.
- [ ] **Race condition on `amount_paid_kobo`** — `recordPayment` and `verifyPaystackPayment` both do a read-then-write on the invoice as two separate round trips, not atomically. Two concurrent payments on the same invoice (e.g. admin recording cash while a Paystack callback lands at the same time) can lose an update — one payment's contribution gets overwritten instead of summed. Fix with a Postgres function/RPC doing `amount_paid_kobo = amount_paid_kobo + :amount` atomically (or a transaction with row locking) instead of the current select-then-update pattern.
- [ ] Flutterwave (Paystack only)
- [ ] Receipt PDF via a real library (currently print-to-PDF, same as report cards)

---

## Parent Portal

- [x] New `parent` role, `guardian_links` table (many-to-many — multiple children per parent, multiple guardians per child)
- [x] Admin creates parent accounts directly, linking one or more children with a relationship label
- [x] Child switcher (URL-param based, preserves current page when switching)
- [x] All 7 confirmed read-only views: attendance, grades & report card, fees & payments (incl. online pay), timetable, homework, announcements, messaging with teachers
- [x] RLS extended additively across every relevant table (`attendance`, `grades`, `report_card_remarks`, `invoices`, `payments`, `lessons`, `timetable_entries`) via an `is_parent_of()` helper function — existing policies untouched, parents layered in with OR'd policies

---

## Messaging, Notes, Announcements

- [x] Messaging — inbox grouped by conversation partner, unread badges, name-search to start new threads, chat-bubble thread view, read-receipt marking on open
- [x] Student notes — staff create/view (behavioral/academic/commendation/disciplinary types), student sees only notes marked visible-to-them
- [x] Announcements — audience targeting (all/students/teachers/specific class), feed
- [ ] Messaging: no Realtime — refresh-based, not live-updating
- [ ] Announcements: attachments, scheduled publish, read tracking
- [ ] **`sendMessage` doesn't validate `recipientId`** before inserting — it relies entirely on RLS/FK constraints to reject bad or unauthorized recipient IDs, so a bad ID currently surfaces as an opaque Postgres error instead of a clean "recipient not found" message. Add an explicit existence/permission check before the insert.

---

## UX, Polish, Reliability

- [x] `error.tsx` boundaries — dashboard-wide + root-level
- [x] Loading states on 6+ key pages (student subjects/homework implicitly, admin students/staff, announcements, topic detail) via `PageLoader`/`Skeleton` components
- [x] Pagination — students, invoices, payments (shared `Pagination` component + helpers)
- [x] Server-side search — students, staff
- [ ] Pagination still missing: staff page, teacher attendance/notes pages
- [x] Active link state in Sidebar
- [x] Breadcrumbs for deep routes
- [ ] Global `TermYearSelector` sync (each page currently has its own independent one)
- [ ] Responsive table handling for mobile — untested
- [x] Zod validation is now present in `lib/validation.ts` and used in the create/edit form paths (`CreateStudentForm`, `CreateClassForm`, `AnnouncementForm`)
- [ ] Toast system / optimistic updates (current pattern is inline "Saved" text after the fact)
- [x] `DeleteEntryButton` now has a confirm/cancel flow with auto-cancel behavior, so the confirm step exists in code and is not purely implicit
- [x] Consistent empty-state component with CTA (`components/EmptyState.tsx` exists and is reusable)
- [ ] New-admin onboarding checklist

---

## Security / RLS (cross-cutting fixes made throughout)

- [x] Every table has explicit RLS policies (several — `subjects`, `classes`, `student_profiles`, `teacher_profiles`, `enrollments`, `lessons`, `assessments` — had none at all early on, silently defaulting to deny-all)
- [x] Teacher grading/attendance scoped to their actual timetable assignment (not "any teacher, any class")
- [x] Class-teacher broader grade visibility (additive policy, doesn't touch existing rules)
- [x] **Critical fix**: `profiles` RLS originally only allowed `id = auth.uid()` — silently breaking every embedded `profiles(...)` join for non-admin users (teacher names on student timetables, etc., showing empty) since the very first migration. Broadened to authenticated-read.
- [x] Parent access added additively across 7 tables via `is_parent_of()`, no existing policy touched
- [ ] Full manual RLS audit pass (spot-fixes done throughout, no single comprehensive review)

---

## Recurring TypeScript/Supabase Bugs Fixed (worth knowing about if new ones appear)

- **`interface` vs `type` for `Database`** — interfaces support declaration merging, which broke `postgrest-js`'s generic resolution and silently collapsed `Insert`/`Update` types to `never`. Fixed by using `type` throughout.
- **Missing `Relationships` metadata** — empty generic `GenericRelationship[]` arrays aren't enough; `postgrest-js` needs literal FK tuples (`foreignKeyName`, `columns`, `referencedRelation`, etc.) to resolve embedded selects like `profiles(full_name)`. Without them, embedded rows silently type as `never`.
- **Record-type indexing on embedded/widened columns** — `STATUS_STYLES[row.status]` breaks when `row.status` gets widened through a join; fix is always `Record<SpecificType, string>` + an explicit cast at the point of indexing.
- **`useState` initializer staleness** — a value computed once at mount (e.g. `classId` defaulting from a `classes` prop that was empty at first render) doesn't update when the prop later changes; needs a `useEffect` to re-sync.
- **Missing `UPDATE` RLS policies** — several tables (`grades`, `attendance`) only ever had `INSERT` policies; since their actions use `.upsert()`, re-saving an existing row was silently blocked by RLS until the `UPDATE` policy was added alongside.

---

## Not Started (P6 — correctly deferred throughout)

CBT/quiz builder, library module, hostel module, transport module, inventory/asset tracking, ID card generator, admission letter/testimonial generator, analytics dashboard, audit log, PWA/offline support, WhatsApp notifications.

---

## Dev, Docs, Quality

- [x] `.env.local.example` includes `SUPABASE_SERVICE_ROLE_KEY` (confirmed present)
- [ ] `README.md` — still the original scaffold version, badly out of date
- [ ] Demo seed script (only a single first-admin SQL snippet exists)
- [ ] Unit tests — none, including for the report-card ranking/averaging logic
- [ ] GitHub Actions (lint/typecheck/build on PR)
- [ ] `prettier`/`eslint` config
- [ ] Switch to `supabase gen types` now that the schema has stabilized, instead of hand-maintaining `database.ts`
- [ ] **Empty `middleware.ts` sitting alongside `proxy.ts`** — the real middleware logic lives in `proxy.ts`, but Next.js's convention is to look for `middleware.ts` specifically. Confirm this is intentionally aliased (e.g. via `next.config.mjs` or a re-export) rather than a stray leftover file, and either wire it up explicitly or delete it to avoid confusing future contributors.

---

## Notes carried through the whole build

- All money values stored as integer kobo — followed throughout the fees module, including Paystack amounts (native kobo for NGN, no conversion needed)
- All dates stored as ISO date strings, displayed formatted per locale
- Server components for data fetching, client components only for interactivity — mostly followed; some `Create*Form` components call the Supabase client directly rather than through a server action, a reasonable but inconsistent alternate pattern
- Keep using `enrollments` for history, don't overwrite `class_id` without it — **now actually followed**, was violated early on until the promotion-workflow batch
