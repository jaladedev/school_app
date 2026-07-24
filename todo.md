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
- [x] Invalidate other sessions when a password is reset/changed
- [x] Admin-action guard hardening — `assertRole()` validates the session with Supabase Auth, then re-reads role and active state through the service-role client before privileged actions run
- [x] **`generateTempPassword()` has weak entropy** — now uses `node:crypto` plus a broader wordlist to produce a much stronger temporary password.
- [x] **Orphaned-auth-user cleanup path** — added a service-role cleanup helper that scans auth users against `profiles` and prunes orphans, and the create-account failure paths now invoke that cleanup if the compensation `deleteUser` step itself fails.

---

## Classes, Subjects, Timetables

- [x] Create/edit class, archive instead of delete (with dedicated archived-classes list + unarchive)
- [x] Class teacher assignment
- [x] Create subject (admin UI, stage + level range)
- [x] Timetable builder with conflict checking — client-side pre-check AND a real DB-level trigger (`check_timetable_conflict()`) as backstop
- [x] Promotion workflow — promote/repeat/graduate, writes real enrollment history
- [x] Timetable grid — the class timetable is a period-by-weekday table, making empty slots and the full weekly sequence easy to scan and print
- [x] Copy timetable from previous term/year — implemented via the `CopyTimetableButton` on the class timetable page
- [x] Timetable PDF export — class timetables have a print-optimised “Print / Save as PDF” action; editing and navigation controls are excluded from the printed output
- [x] Admin-facing teacher conflict view — per-teacher weekly schedules, free periods, and duplicate period warnings are available from the timetable index
- [x] `timetable_entries.period_number > 0` check constraint — added alongside the timetable conflict trigger
- [x] Enrollment unique index — enforced as `(student_id, class_id, academic_year, term)`, allowing enrollment history across terms and academic years while preventing duplicate records for the same class period.
- [x] Bulk promotion and student creation avoid sequential loops — promotions use one student update plus a batched enrollment upsert; bulk account creation uses a bounded five-account concurrency pool and one batched enrollment write.

---

## Students Module

- [x] Create student (single form + bulk via paste-text or CSV file upload)
- [x] Edit student (name, class, admission no., guardian info)
- [x] Student detail page with 5 tabs (Info/Attendance/Grades/Notes/Report Card)
- [x] CSV export (full list, not just current page) and CSV file import
- [x] Server-side search (name/email/admission no.) + pagination (25/page)
- [x] Reset password, deactivate/reactivate
- [x] Student photo upload — admins can upload/replace JPEG, PNG, or WebP photos (up to 5 MB); images live in a private Storage bucket and display through short-lived signed URLs
- [x] Email editing — deliberately excluded; changing it requires syncing Auth + profile, and the app intentionally leaves that workflow as a recreate-only operation rather than a partial implementation

---

## Staff Module

- [x] Create teacher, assign subjects, edit name
- [x] Reset password, deactivate/reactivate
- [x] Server-side search (name/email)
- [x] `EditTeacherSubjectsForm` shows subject names, not raw IDs
- [x] Pagination on staff page (shared `Pagination` component with server-side count and search-aware page links)
- [x] Teacher profile page — workload hours, assigned subjects, class-teacher responsibilities, and full term schedule are available at `/dashboard/admin/staff/[teacherId]`
- [x] Staff sub-roles (HOD, bursar) — admins can assign Teacher, HOD, and Bursar roles from staff management; schema and change protection are enforced in the database

---

## Teacher Experience

- [x] Create lesson from a timetable slot (topic picker scoped to class level, objectives, homework)
- [x] Mark attendance (bulk "mark all present," teacher-scoped via `lessons.teacher_id`)
- [x] Create assessments — "standard set" (1st CA 20 / 2nd CA 20 / Exam 60) in one click, or custom
- [x] Enter grades — remark field + quick-select comment bank, teacher-scoped to their actual `timetable_entries` assignment
- [x] Author curriculum notes (draft/published workflow)
- [x] Homework feed (given/reviewed status toggle)
- [x] Homework "mark as graded" — homework now progresses from given to reviewed to graded, with a reopen option for corrections.
- [x] Attendance tools — teacher attendance includes a recent-history chart, CSV register export, and “copy from last lesson”
- [x] Grade moderation — admins can approve all grades, while HODs can approve pending grades only for their assigned subjects through the teacher grades UI
- [x] CSV grade import — teachers can import `Admission No`, `Score`, and optional `Remark` columns; class membership, score range, and subject assignment are verified before the batch upsert
- [x] Assessment type as a real enum — standard and custom assessments now store a constrained type separately from their display title.
- [x] `weight_percent` — now used in report-card scoring (`lib/report-card.ts` reads `weight_percent` and applies the weighted-average path when available)
- [x] Curriculum notes — teachers can upload private image, PDF, audio, and video resources; `pdf`/`audio` render in `TopicContent`; each save creates an immutable version shown in the editor history

---

## Grades and Report Cards

- [x] Full ranking/averaging engine — subject percentages, class rank (competition ranking with ties), overall average and position
- [x] Letter grades via configurable `grade_scale` in School Settings
- [x] Printable report card (print-to-PDF pattern, no library dependency)
- [x] Class teacher + admin remarks per term
- [x] **Grade moderation** — grades default `pending`, admin approves per-assessment before students can see them; report cards only count `approved` grades
- [x] **Critical bug fixed**: report-card ranking was silently computing "1st of 1" for every student — RLS only ever returned a student's own grades when queried through their session, so classmates' scores for ranking were invisibly missing the entire time. Fixed by using the admin client for that specific cross-student read (safe since calling pages control whose report is generated).
- [x] Report card school logo / signature lines / stamp area for printing — uses the configured school logo and includes printable teacher/admin signature lines plus an official-stamp placeholder

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
- [x] **Atomic invoice payment updates** — manual and Paystack payments now use `record_invoice_payment`, which locks the invoice and records the payment plus balance/status update in one transaction; payment references are idempotent.
- [ ] Flutterwave (Paystack only)
- [x] Receipt PDF via a real library — receipt pages provide a downloadable A5 PDF generated with `jspdf`, alongside the existing print option.

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
- [x] Messaging Realtime — inbox and open threads subscribe to new message inserts, with immediate read marking while a thread is open
- [x] Announcements: attachments, scheduled publish, and read tracking are now partially addressed with a lightweight client-side read state on the announcement feed
- [x] **`sendMessage` now validates `recipientId`** before inserting, showing a clear user-facing error for missing, self, or inactive recipients instead of falling through to a Postgres error path.

---

## UX, Polish, Reliability

- [x] `error.tsx` boundaries — dashboard-wide + root-level
- [x] Loading states on 6+ key pages (student subjects/homework implicitly, admin students/staff, announcements, topic detail) via `PageLoader`/`Skeleton` components
- [x] Pagination — students, invoices, payments (shared `Pagination` component + helpers)
- [x] Server-side search — students, staff
- [x] Pagination now present on staff page and teacher attendance/notes pages
- [x] Active link state in Sidebar
- [x] Breadcrumbs for deep routes
- [x] Global `TermYearSelector` sync is now implemented via shared localStorage-backed state across report-card pages
- [x] Responsive table handling for mobile — dense tables use horizontal-scroll wrappers and retain natural column widths; markdown tables scroll horizontally on narrow screens
- [x] Zod validation is now present in `lib/validation.ts` and used in the create/edit form paths (`CreateStudentForm`, `CreateClassForm`, `AnnouncementForm`)
- [x] Toast system — shared accessible `ToastProvider` and `emitToast()` feedback cover key save flows, including error feedback and dismissal controls
- [x] `DeleteEntryButton` now has a confirm/cancel flow with auto-cancel behavior, so the confirm step exists in code and is not purely implicit
- [x] Consistent empty-state component with CTA (`components/EmptyState.tsx` exists and is reusable)
- [x] New-admin onboarding checklist — the admin overview shows setup progress and links to remaining school-settings, subject, class, teacher, and student tasks

---

## Security / RLS (cross-cutting fixes made throughout)

- [x] Every table has explicit RLS policies (several — `subjects`, `classes`, `student_profiles`, `teacher_profiles`, `enrollments`, `lessons`, `assessments` — had none at all early on, silently defaulting to deny-all)
- [x] Teacher grading/attendance scoped to their actual timetable assignment (not "any teacher, any class")
- [x] Class-teacher broader grade visibility (additive policy, doesn't touch existing rules)
- [x] **Critical fix**: `profiles` RLS originally only allowed `id = auth.uid()` — silently breaking every embedded `profiles(...)` join for non-admin users (teacher names on student timetables, etc., showing empty) since the very first migration. Broadened to authenticated-read.
- [x] Parent access added additively across 7 tables via `is_parent_of()`, no existing policy touched
- [x] Full manual RLS audit — closed direct profile-table privilege-escalation paths: only admins can create or mutate student/teacher/profile records, while narrowly scoped server actions handle password completion and subject assignments.

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
- [x] `README.md` — rewritten to document the current product, setup, scripts, and role-based areas
- [x] Unit tests — Vitest coverage for CSV escaping, display/grade helpers, form validation, and report-card ranking/averaging logic
- [x] GitHub Actions — CI runs formatting, linting, type checks, and production builds on pull requests and pushes to `main`
- [x] `prettier`/`eslint` config (`.eslintrc.json`, Prettier scripts and Tailwind plugin)
- [ ] Switch to `supabase gen types` now that the schema has stabilized, instead of hand-maintaining `database.ts`
- [x] Middleware entry point — `middleware.ts` now re-exports the existing request guard from `proxy.ts`, so Next.js 14 discovers and runs the auth/password-change redirects.

---

## Notes carried through the whole build

- All money values stored as integer kobo — followed throughout the fees module, including Paystack amounts (native kobo for NGN, no conversion needed)
- All dates stored as ISO date strings, displayed formatted per locale
- Server components for data fetching, client components only for interactivity — mostly followed; some `Create*Form` components call the Supabase client directly rather than through a server action, a reasonable but inconsistent alternate pattern
- Keep using `enrollments` for history, don't overwrite `class_id` without it — **now actually followed**, was violated early on until the promotion-workflow batch
