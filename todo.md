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
- [x] `curriculum_topics` formalized as each subject's scheme of work — added `academic_year` (schemes can be revised year to year) and `week_number` (1–14, unique per subject/level/term/year). Admin sets `school_settings.current_term_start_date`; a `current_scheme_week()` SQL function derives the current week from it. Teacher dashboard now pre-selects that week's topic in the "Log lesson" form (labeled "(this week)"), teacher can still override. Migration backfilled `week_number` from the old `sequence_order` — flagged for manual verification against the real scheme of work before trusting it in prod.

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

## Library Module

- [x] Catalog — `library_books` (title, author, ISBN, category, total/available copies, archive flag). Create/edit/archive via `lib/actions/library.ts`; catalog itself is readable by any authenticated user (students/parents can browse what's available). `/dashboard/library`.
- [x] Borrow/return — `library_loans` (book_id, student_id, borrowed_at, due_at, returned_at, issued_by, returned_to). Both actions go through SECURITY DEFINER RPCs (`borrow_library_book`, `return_library_book`) rather than direct table writes, so `available_copies` can never desync from actual loan state — the RPC locks the book row, checks availability, and updates the count in the same transaction. Each RPC enforces `is_admin() OR is_librarian()` internally as defense-in-depth, not just at the server-action layer. `/dashboard/library/loans`.
- [x] Overdue tracking — computed on read (`isLoanOverdue()` in `types/database.ts`: `!returned_at && due_at < today`), not a stored status column, so it can't go stale. Surfaced with a red border + "Overdue" label on all loan views.
- [x] Daily overdue rate trend — `getLibraryOverdueTrend()` in `lib/analytics.ts`, capped at a trailing 30 days (`OVERDUE_TREND_CAP_DAYS`) so the per-day computation stays bounded regardless of how long the library's been in use. For each of the last 30 days, computes what fraction of loans active _as of that day_ were overdue _as of that day_ (not just "overdue now"), from a single `library_loans` fetch aggregated in JS. New card on `/dashboard/admin/analytics`.
- [x] Student view (`/dashboard/student/library`) and parent view (`/dashboard/parent/library`, follows the existing `ChildSwitcher` pattern) — current borrows + due dates; student view also shows past/returned history.
- [x] Librarian staff role — added `librarian` to `StaffRole` (`teacher | hod | bursar | librarian`), an `is_librarian()` SQL helper, and updated the catalog/loan RLS policies and both RPCs to accept it alongside `is_admin()`. Library management moved from `/dashboard/admin/library` to a role-agnostic `/dashboard/library`, gated by its own layout (`app/dashboard/library/layout.tsx`) that allows admin or a teacher whose `staff_role` is `librarian`. Sidebar now conditionally shows a "Library" entry in the teacher nav only for librarians (`Sidebar` takes a new `staffRole` prop, threaded from `app/dashboard/layout.tsx`). **Migration note**: `ALTER TYPE staff_role ADD VALUE` can't run in the same transaction as anything referencing the new value — shipped as two separate migration files, run part 1 fully before part 2.
- [x] Student search/typeahead on the issue-loan form — replaced the plain `<select>` of every student with `StudentTypeahead` (dependency-free, filters by name/admission-no/class, arrow-key navigation), so it stays usable as the school's roll grows.
- [x] Both catalog writes and loan issue/return are logged to `audit_log` via the existing `writeAuditLog()` helper.
- [x] Fine integration — per day overdue, charged automatically, straight to the student's invoices with no approval step. Computed inside `return_library_book` itself (not app code) so it fires regardless of call path: `overdue_days = GREATEST(0, returned_date - due_at)`, `fine_kobo = overdue_days * school_settings.library_fine_kobo_per_day`. Rate defaults to 0 (fines off) — admin sets it in Settings ("Library fine (per day overdue)"), stored in kobo like every other money field in this app. Lazily creates/reuses a "Library Fine" `fee_structures` row per `(education_level, level_number, term, academic_year)` so fine invoices sit alongside regular fees in the student/parent fees views with no changes needed there, and the existing `trg_log_invoice_change` trigger picks it up for the audit log automatically. RPC return shape changed from a bare loan row to a flat table (loan columns + `overdue_days` + `fine_kobo`), so the UI shows the librarian exactly what was charged instead of re-deriving it. A student with no class assigned is skipped (can't be invoiced against a class-scoped fee_structure) rather than failing the whole return.
- [x] Waive fine — `waiveLibraryFine()` on the "Outstanding library fines" panel of `/dashboard/library/loans`. Scoped strictly to invoices whose `fee_structures.title === "Library Fine"` (can't be used as a backdoor discount tool on regular fees), blocked if anything's already been paid on it (points to the fees module for a refund instead) or if it's already fully waived. Implemented as a 100%-discount (`discount_kobo = total_amount_kobo`) rather than using the unused `voided_at`/`voided_by`/`void_reason` columns already on `invoices` — those aren't read anywhere in the app yet, so wiring them up would've meant also touching `invoice_dashboard_totals`, the defaulters export, and every fee balance display to respect them. The discount route reuses infrastructure that already works everywhere. Optional reason captured in the `audit_log` entry (`library_fine_waived`).
- [x] **Bug fix found & fixed while building this**: `computeStatus()` (now `computeInvoiceStatus()`, moved to `lib/invoiceStatus.ts` so a `"use server"` file could still export it — Next.js requires every export from a `"use server"` module to be async) treated an invoice with nothing owed (0 ≤ 0) as `"unpaid"` unless something had actually been paid. A fully-discounted invoice — like a waived fine — would've kept showing as unpaid and still appeared on the defaulters export. Fixed: owed ≤ 0 is now always `"paid"`, regardless of amount actually paid. This also affects `applyDiscount()` in the regular fees module, not just library fines — a pre-existing bug, not something introduced by the library work.
- [ ] Still not read anywhere in the app: `invoices.voided_at`/`voided_by`/`void_reason`. If a real void/cancel flow (distinct from a discount-to-zero) is wanted later for the general fees module, those columns are sitting there ready but unused.

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
- [x] Analytics dashboard — `/dashboard/admin/analytics`, added to admin nav. Five aggregate views: enrollment by term (`enrollments`), fee collection (billed/collected/outstanding per term, `invoices`), average grades by subject for the current term (approved grades only, joined via `assessments`), attendance rate over the trailing 8 weeks (`attendance` joined to `lessons.lesson_date`, bucketed by week), and teacher workload (scheduled periods/week from `timetable_entries` for the current term). All read-only aggregation in `lib/analytics.ts` — no new tables. No charting library was added to the project — rendered with a small dependency-free `BarList` component (proportional-width divs) instead, consistent with the bandwidth-conscious approach used elsewhere. Two scope notes: grades are broken down by subject only, not further by class (the original ask mentioned "by subject/class"); and the fee/enrollment trends group by every `(academic_year, term)` combination found in the data with no cap, which is fine at current data volumes but worth capping/paginating if terms accumulate for many years.

---

## Security / RLS (cross-cutting fixes made throughout)

- [x] Every table has explicit RLS policies (several — `subjects`, `classes`, `student_profiles`, `teacher_profiles`, `enrollments`, `lessons`, `assessments` — had none at all early on, silently defaulting to deny-all)
- [x] Teacher grading/attendance scoped to their actual timetable assignment (not "any teacher, any class")
- [x] Class-teacher broader grade visibility (additive policy, doesn't touch existing rules)
- [x] **Critical fix**: `profiles` RLS originally only allowed `id = auth.uid()` — silently breaking every embedded `profiles(...)` join for non-admin users (teacher names on student timetables, etc., showing empty) since the very first migration. Broadened to authenticated-read.
- [x] Parent access added additively across 7 tables via `is_parent_of()`, no existing policy touched
- [x] Full manual RLS audit — closed direct profile-table privilege-escalation paths: only admins can create or mutate student/teacher/profile records, while narrowly scoped server actions handle password completion and subject assignments.
- [x] Audit log completed — `audit_log` table, RLS (admin/bursar read), and trigger coverage (`enrollments`, `fee_structures`, `invoices`, `log_receipt_print()`) already existed; added the missing pieces: `lib/audit.ts` (`writeAuditLog()` helper), coverage for grade approval (bulk + single), user deactivation/reactivation, and staff role changes — each via app-code inserts rather than triggers, since those live in server actions rather than direct table writes. New `/dashboard/admin/audit-log` page (filterable by entity type, paginated) surfaces it; added to admin nav. `curriculum_topics.week_number`/scheme-of-work locking-down work earlier this session is not itself audit-logged — flagging in case that's wanted too.

---

## Recurring TypeScript/Supabase Bugs Fixed (worth knowing about if new ones appear)

- **`interface` vs `type` for `Database`** — interfaces support declaration merging, which broke `postgrest-js`'s generic resolution and silently collapsed `Insert`/`Update` types to `never`. Fixed by using `type` throughout.
- **Missing `Relationships` metadata** — empty generic `GenericRelationship[]` arrays aren't enough; `postgrest-js` needs literal FK tuples (`foreignKeyName`, `columns`, `referencedRelation`, etc.) to resolve embedded selects like `profiles(full_name)`. Without them, embedded rows silently type as `never`.
- **Record-type indexing on embedded/widened columns** — `STATUS_STYLES[row.status]` breaks when `row.status` gets widened through a join; fix is always `Record<SpecificType, string>` + an explicit cast at the point of indexing.
- **`useState` initializer staleness** — a value computed once at mount (e.g. `classId` defaulting from a `classes` prop that was empty at first render) doesn't update when the prop later changes; needs a `useEffect` to re-sync.
- **Missing `UPDATE` RLS policies** — several tables (`grades`, `attendance`) only ever had `INSERT` policies; since their actions use `.upsert()`, re-saving an existing row was silently blocked by RLS until the `UPDATE` policy was added alongside.

---

## Not Started (P6 — correctly deferred throughout)

- [ ] CBT/quiz builder — teachers author objective-question tests (MCQ, true/false, maybe fill-in-blank) tied to a subject/class; students take them in a timed browser session, auto-graded on submit. New tables (`quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`); feeds into `grades`/`assessments` as another assessment type so it inherits the existing moderation-approval flow rather than becoming a separate system.
- [ ] Hostel module — for boarding students: room/bed assignment (`hostels`, `hostel_rooms`, `hostel_assignments` linking student_id to a room), house-master/matron oversight, maybe check-in/check-out logs for leave requests. Would need a new staff sub-role (same pattern as the HOD/bursar `staff_role` work) for house parents.
- [ ] Transport module — school bus routes/stops (`bus_routes`, `bus_stops`), student-to-route assignment, driver/vehicle records, possibly a live "bus left/arrived" status parents can see — that last part would reuse the Realtime wiring already built for messaging.
- [ ] Inventory/asset tracking — non-book school assets (furniture, lab equipment, computers, sports gear): `assets` table (name, category, serial no., condition, location/assigned-to), audit trail of who has what and when it was last checked. Admin-only, record-keeping rather than student/parent-facing.
- [ ] ID card generator — pulls existing `profiles` + uploaded photo into a print-ready card template (school logo, name, class/role, ID number, maybe a QR code to a verification page). Same print-to-PDF pattern already used for report cards and receipts.
- [ ] Admission letter/testimonial generator — template-driven documents pulling from `student_profiles`/`enrollments`: an admission letter on student creation, a testimonial/leaving certificate on graduation (promotion workflow already tracks graduate status). Same print-to-PDF pattern; mostly a templating/mail-merge problem, no new data model needed.
- [ ] PWA/offline support — service worker + manifest so the app installs like a native app and core screens (today's attendance, a cached timetable) work with spotty connectivity — genuinely relevant given the target market. Needs a decision on which flows must work offline (attendance marking is the obvious one) and a write-queue for syncing once back online.

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
