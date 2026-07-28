-- ============================================================================
-- school_app initial schema
-- Reconstructed from a schema dump (tables, FKs, RLS policies, functions,
-- triggers). Enum member lists were NOT included in the dump (Postgres
-- reported them as "USER-DEFINED"), so they are inferred from usage
-- throughout the dump (function bodies, default values, column names).
-- ⚠️ REVIEW the "ASSUMED ENUM VALUES" block below against your real project
-- before running this against production — adjust members/order as needed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ASSUMED ENUM VALUES (inferred — verify before relying on this in prod)
-- ----------------------------------------------------------------------------

-- used by: assessments.assessment_type (default 'other')
create type assessment_type as enum ('exam', 'test', 'quiz', 'assignment', 'project', 'other');

-- used by: assets.condition (default 'good')
create type asset_condition as enum ('new', 'good', 'fair', 'poor', 'damaged');

-- used by: attendance.status
create type attendance_status as enum ('present', 'absent', 'late', 'excused');

-- used by: classes.education_level, curriculum_topics.education_level,
-- fee_structures.education_level, subjects.education_level,
-- valid_level_number() checks 'primary' | 'jss' | 'sss'
create type education_level as enum ('primary', 'jss', 'sss');

-- used by: lessons.homework_status (default 'given')
create type homework_status as enum ('given', 'submitted', 'graded', 'none');

-- used by: invoices.status (default 'unpaid'), record_invoice_payment()
create type invoice_status as enum ('unpaid', 'partial', 'paid', 'void');

-- used by: topic_notes.status (default 'published')
create type note_status as enum ('draft', 'published', 'archived');

-- used by: student_notes.note_type
create type student_note_type as enum ('general', 'behavioral', 'academic', 'medical', 'commendation', 'concern');

-- used by: profiles.role
create type user_role as enum ('admin', 'teacher', 'student', 'parent');

-- used by: teacher_profiles.staff_role (default 'teacher'), referenced by
-- is_bursar()/is_hod_of_subject()/is_house_parent()/is_librarian()/is_transport_officer()
create type staff_role as enum ('teacher', 'hod', 'bursar', 'librarian', 'transport_officer', 'house_parent');

-- ----------------------------------------------------------------------------
-- Tables (dependency order: no-FK / self-contained tables first)
-- ----------------------------------------------------------------------------

create table profiles (
  id uuid not null,
  role user_role not null,
  full_name text not null,
  avatar_url text,
  created_at timestamp with time zone default now(),
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  constraint profiles_pkey primary key (id)
);

create table profile_contacts (
  id uuid not null,
  email text not null,
  phone text,
  constraint profile_contacts_pkey primary key (id),
  constraint profile_contacts_id_fkey foreign key (id) references profiles(id)
);

create table teacher_profiles (
  id uuid not null,
  staff_id text,
  subjects_taught uuid[],
  hire_date date,
  staff_role staff_role not null default 'teacher',
  constraint teacher_profiles_pkey primary key (id)
  -- NB: dump doesn't show an explicit FK row for teacher_profiles.id -> profiles.id,
  -- but every RLS policy / function treats it as 1:1 with profiles. Add if desired:
  -- , constraint teacher_profiles_id_fkey foreign key (id) references profiles(id)
);

create table classes (
  id uuid not null default gen_random_uuid(),
  name text not null,
  arm text,
  class_teacher_id uuid,
  academic_year text not null,
  created_at timestamp with time zone default now(),
  education_level education_level not null,
  level_number integer not null,
  is_archived boolean not null default false,
  constraint classes_pkey primary key (id),
  constraint classes_class_teacher_id_fkey foreign key (class_teacher_id) references teacher_profiles(id)
);

create table student_profiles (
  id uuid not null,
  admission_no text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  class_id uuid,
  gender text,
  constraint student_profiles_pkey primary key (id),
  constraint student_profiles_class_id_fkey foreign key (class_id) references classes(id)
  -- , constraint student_profiles_id_fkey foreign key (id) references profiles(id)
);

create table subjects (
  id uuid not null default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  education_level education_level not null,
  min_level_number integer not null,
  max_level_number integer not null,
  constraint subjects_pkey primary key (id)
);

create table enrollments (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  academic_year text not null,
  term integer not null,
  enrolled_at timestamp with time zone default now(),
  constraint enrollments_pkey primary key (id),
  constraint enrollments_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint enrollments_class_id_fkey foreign key (class_id) references classes(id)
);

create table guardian_links (
  id uuid not null default gen_random_uuid(),
  parent_id uuid,
  student_id uuid,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamp with time zone default now(),
  constraint guardian_links_pkey primary key (id),
  constraint guardian_links_parent_id_fkey foreign key (parent_id) references profiles(id),
  constraint guardian_links_student_id_fkey foreign key (student_id) references student_profiles(id)
);

create table announcements (
  id uuid not null default gen_random_uuid(),
  author_id uuid,
  title text not null,
  content text not null,
  audience text not null,
  class_id uuid,
  created_at timestamp with time zone default now(),
  constraint announcements_pkey primary key (id),
  constraint announcements_author_id_fkey foreign key (author_id) references profiles(id),
  constraint announcements_class_id_fkey foreign key (class_id) references classes(id)
);

create table assessments (
  id uuid not null default gen_random_uuid(),
  subject_id uuid,
  class_id uuid,
  title text not null,
  max_score numeric not null,
  weight_percent numeric,
  term integer not null,
  academic_year text not null,
  created_by uuid,
  assessment_type assessment_type not null default 'other',
  constraint assessments_pkey primary key (id),
  constraint assessments_subject_id_fkey foreign key (subject_id) references subjects(id),
  constraint assessments_class_id_fkey foreign key (class_id) references classes(id),
  constraint assessments_created_by_fkey foreign key (created_by) references teacher_profiles(id)
);

create table assets (
  id uuid not null default gen_random_uuid(),
  name text not null,
  category text,
  serial_no text,
  condition asset_condition not null default 'good',
  location text,
  assigned_to text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint assets_pkey primary key (id),
  constraint assets_created_by_fkey foreign key (created_by) references profiles(id)
);

create table audit_log (
  id uuid not null default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint audit_log_pkey primary key (id),
  constraint audit_log_actor_id_fkey foreign key (actor_id) references profiles(id)
);

create table conversation_archives (
  user_id uuid not null,
  partner_id uuid not null,
  archived_at timestamp with time zone not null default now(),
  constraint conversation_archives_pkey primary key (user_id, partner_id),
  constraint conversation_archives_user_id_fkey foreign key (user_id) references profiles(id),
  constraint conversation_archives_partner_id_fkey foreign key (partner_id) references profiles(id)
);

create table curriculum_topics (
  id uuid not null default gen_random_uuid(),
  subject_id uuid,
  term integer not null,
  title text not null,
  description text,
  sequence_order integer not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  education_level education_level not null,
  level_number integer not null,
  academic_year text not null,
  week_number integer not null,
  constraint curriculum_topics_pkey primary key (id),
  constraint curriculum_topics_created_by_fkey foreign key (created_by) references profiles(id),
  constraint curriculum_topics_subject_id_fkey foreign key (subject_id) references subjects(id)
);

create table fee_structures (
  id uuid not null default gen_random_uuid(),
  education_level education_level not null,
  level_number integer not null,
  term integer not null,
  academic_year text not null,
  title text not null,
  amount_kobo bigint not null,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone default now(),
  voided_at timestamp with time zone,
  voided_by uuid,
  constraint fee_structures_pkey primary key (id),
  constraint fee_structures_created_by_fkey foreign key (created_by) references profiles(id),
  constraint fee_structures_voided_by_fkey foreign key (voided_by) references profiles(id)
);

create table hostels (
  id uuid not null default gen_random_uuid(),
  name text not null,
  gender text not null,
  house_parent_id uuid,
  capacity integer,
  created_at timestamp with time zone not null default now(),
  constraint hostels_pkey primary key (id),
  constraint hostels_house_parent_id_fkey foreign key (house_parent_id) references teacher_profiles(id)
);

create table hostel_rooms (
  id uuid not null default gen_random_uuid(),
  hostel_id uuid not null,
  room_number text not null,
  capacity integer not null default 4,
  created_at timestamp with time zone not null default now(),
  constraint hostel_rooms_pkey primary key (id),
  constraint hostel_rooms_hostel_id_fkey foreign key (hostel_id) references hostels(id)
);

create table hostel_assignments (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  room_id uuid not null,
  academic_year text not null,
  assigned_at timestamp with time zone not null default now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid,
  constraint hostel_assignments_pkey primary key (id),
  constraint hostel_assignments_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint hostel_assignments_room_id_fkey foreign key (room_id) references hostel_rooms(id),
  constraint hostel_assignments_assigned_by_fkey foreign key (assigned_by) references profiles(id)
);

create table hostel_fee_structures (
  id uuid not null default gen_random_uuid(),
  hostel_id uuid not null,
  term integer not null,
  academic_year text not null,
  title text not null default 'Hostel Fee',
  amount_kobo bigint not null,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  voided_at timestamp with time zone,
  voided_by uuid,
  constraint hostel_fee_structures_pkey primary key (id),
  constraint hostel_fee_structures_hostel_id_fkey foreign key (hostel_id) references hostels(id),
  constraint hostel_fee_structures_created_by_fkey foreign key (created_by) references profiles(id),
  constraint hostel_fee_structures_voided_by_fkey foreign key (voided_by) references profiles(id)
);

create table hostel_leave_logs (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  reason text,
  out_at timestamp with time zone not null default now(),
  expected_return_at timestamp with time zone,
  returned_at timestamp with time zone,
  logged_by uuid,
  returned_logged_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint hostel_leave_logs_pkey primary key (id),
  constraint hostel_leave_logs_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint hostel_leave_logs_logged_by_fkey foreign key (logged_by) references profiles(id),
  constraint hostel_leave_logs_returned_logged_by_fkey foreign key (returned_logged_by) references profiles(id)
);

create table hostel_waitlist (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  hostel_id uuid not null,
  requested_at timestamp with time zone not null default now(),
  requested_by uuid,
  fulfilled_at timestamp with time zone,
  fulfilled_room_id uuid,
  cancelled_at timestamp with time zone,
  constraint hostel_waitlist_pkey primary key (id),
  constraint hostel_waitlist_hostel_id_fkey foreign key (hostel_id) references hostels(id),
  constraint hostel_waitlist_requested_by_fkey foreign key (requested_by) references profiles(id),
  constraint hostel_waitlist_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint hostel_waitlist_fulfilled_room_id_fkey foreign key (fulfilled_room_id) references hostel_rooms(id)
);

create table vehicles (
  id uuid not null default gen_random_uuid(),
  plate_number text not null,
  model text,
  capacity integer not null,
  driver_name text,
  driver_phone text,
  is_archived boolean not null default false,
  created_at timestamp with time zone not null default now(),
  driver_profile_id uuid,
  constraint vehicles_pkey primary key (id)
  -- , constraint vehicles_driver_profile_id_fkey foreign key (driver_profile_id) references profiles(id)
);

create table transport_routes (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  vehicle_id uuid,
  is_archived boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint transport_routes_pkey primary key (id),
  constraint transport_routes_vehicle_id_fkey foreign key (vehicle_id) references vehicles(id)
);

create table transport_stops (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  name text not null,
  sequence_order integer not null,
  approx_time time without time zone,
  created_at timestamp with time zone not null default now(),
  constraint transport_stops_pkey primary key (id),
  constraint transport_stops_route_id_fkey foreign key (route_id) references transport_routes(id)
);

create table transport_assignments (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  route_id uuid not null,
  stop_id uuid not null,
  academic_year text not null,
  assigned_at timestamp with time zone not null default now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid,
  constraint transport_assignments_pkey primary key (id),
  constraint transport_assignments_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint transport_assignments_route_id_fkey foreign key (route_id) references transport_routes(id),
  constraint transport_assignments_stop_id_fkey foreign key (stop_id) references transport_stops(id),
  constraint transport_assignments_assigned_by_fkey foreign key (assigned_by) references profiles(id)
);

create table transport_fee_structures (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  term integer not null,
  academic_year text not null,
  title text not null default 'Transport Fee',
  amount_kobo bigint not null,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  voided_at timestamp with time zone,
  voided_by uuid,
  constraint transport_fee_structures_pkey primary key (id),
  constraint transport_fee_structures_route_id_fkey foreign key (route_id) references transport_routes(id),
  constraint transport_fee_structures_created_by_fkey foreign key (created_by) references profiles(id),
  constraint transport_fee_structures_voided_by_fkey foreign key (voided_by) references profiles(id)
);

create table transport_locations (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  trip_date date not null,
  direction text not null,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamp with time zone not null default now(),
  recorded_by uuid,
  constraint transport_locations_pkey primary key (id),
  constraint transport_locations_route_id_fkey foreign key (route_id) references transport_routes(id),
  constraint transport_locations_recorded_by_fkey foreign key (recorded_by) references profiles(id)
);

create table transport_trip_status (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  trip_date date not null,
  direction text not null,
  status text not null default 'not_started',
  updated_by uuid,
  updated_at timestamp with time zone not null default now(),
  constraint transport_trip_status_pkey primary key (id),
  constraint transport_trip_status_route_id_fkey foreign key (route_id) references transport_routes(id),
  constraint transport_trip_status_updated_by_fkey foreign key (updated_by) references profiles(id)
);

create table route_vehicle_history (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  vehicle_id uuid not null,
  assigned_at timestamp with time zone not null default now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid,
  constraint route_vehicle_history_pkey primary key (id),
  constraint route_vehicle_history_route_id_fkey foreign key (route_id) references transport_routes(id),
  constraint route_vehicle_history_vehicle_id_fkey foreign key (vehicle_id) references vehicles(id),
  constraint route_vehicle_history_assigned_by_fkey foreign key (assigned_by) references profiles(id)
);

create table invoices (
  id uuid not null default gen_random_uuid(),
  student_id uuid,
  fee_structure_id uuid,
  term integer not null,
  academic_year text not null,
  total_amount_kobo bigint not null,
  discount_kobo bigint not null default 0,
  amount_paid_kobo bigint not null default 0,
  status invoice_status not null default 'unpaid',
  created_at timestamp with time zone default now(),
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  transport_fee_structure_id uuid,
  hostel_fee_structure_id uuid,
  constraint invoices_pkey primary key (id),
  constraint invoices_fee_structure_id_fkey foreign key (fee_structure_id) references fee_structures(id),
  constraint invoices_transport_fee_structure_id_fkey foreign key (transport_fee_structure_id) references transport_fee_structures(id),
  constraint invoices_hostel_fee_structure_id_fkey foreign key (hostel_fee_structure_id) references hostel_fee_structures(id),
  constraint invoices_voided_by_fkey foreign key (voided_by) references profiles(id),
  constraint invoices_student_id_fkey foreign key (student_id) references student_profiles(id)
);

create table payments (
  id uuid not null default gen_random_uuid(),
  invoice_id uuid,
  student_id uuid,
  amount_kobo bigint not null,
  method text not null,
  reference text,
  verified_by uuid,
  paid_at timestamp with time zone default now(),
  constraint payments_pkey primary key (id),
  constraint payments_verified_by_fkey foreign key (verified_by) references profiles(id),
  constraint payments_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint payments_invoice_id_fkey foreign key (invoice_id) references invoices(id)
);

create table timetable_entries (
  id uuid not null default gen_random_uuid(),
  class_id uuid,
  subject_id uuid,
  teacher_id uuid,
  weekday integer not null,
  period_number integer not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  room text,
  academic_year text not null,
  term integer not null,
  constraint timetable_entries_pkey primary key (id),
  constraint timetable_entries_class_id_fkey foreign key (class_id) references classes(id),
  constraint timetable_entries_subject_id_fkey foreign key (subject_id) references subjects(id),
  constraint timetable_entries_teacher_id_fkey foreign key (teacher_id) references teacher_profiles(id)
);

create table lessons (
  id uuid not null default gen_random_uuid(),
  timetable_entry_id uuid,
  topic_id uuid,
  class_id uuid,
  teacher_id uuid,
  lesson_date date not null,
  objectives text,
  homework text,
  created_at timestamp with time zone default now(),
  homework_status homework_status not null default 'given',
  constraint lessons_pkey primary key (id),
  constraint lessons_teacher_id_fkey foreign key (teacher_id) references teacher_profiles(id),
  constraint lessons_class_id_fkey foreign key (class_id) references classes(id),
  constraint lessons_topic_id_fkey foreign key (topic_id) references curriculum_topics(id),
  constraint lessons_timetable_entry_id_fkey foreign key (timetable_entry_id) references timetable_entries(id)
);

create table attendance (
  id uuid not null default gen_random_uuid(),
  lesson_id uuid,
  student_id uuid,
  status attendance_status not null,
  marked_by uuid,
  marked_at timestamp with time zone default now(),
  constraint attendance_pkey primary key (id),
  constraint attendance_lesson_id_fkey foreign key (lesson_id) references lessons(id),
  constraint attendance_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint attendance_marked_by_fkey foreign key (marked_by) references teacher_profiles(id)
);

create table grades (
  id uuid not null default gen_random_uuid(),
  assessment_id uuid,
  student_id uuid,
  score numeric not null,
  remark text,
  graded_by uuid,
  graded_at timestamp with time zone default now(),
  moderation_status text not null default 'pending',
  constraint grades_pkey primary key (id),
  constraint grades_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint grades_graded_by_fkey foreign key (graded_by) references teacher_profiles(id),
  constraint grades_assessment_id_fkey foreign key (assessment_id) references assessments(id)
);

create table quizzes (
  id uuid not null default gen_random_uuid(),
  assessment_id uuid not null,
  duration_minutes integer not null,
  opens_at timestamp with time zone,
  closes_at timestamp with time zone,
  is_published boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint quizzes_pkey primary key (id),
  constraint quizzes_assessment_id_fkey foreign key (assessment_id) references assessments(id)
);

create table quiz_questions (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  question_text text not null,
  question_type text not null,
  points numeric not null default 1,
  sequence_order integer not null,
  created_at timestamp with time zone not null default now(),
  constraint quiz_questions_pkey primary key (id),
  constraint quiz_questions_quiz_id_fkey foreign key (quiz_id) references quizzes(id)
);

create table quiz_options (
  id uuid not null default gen_random_uuid(),
  question_id uuid not null,
  option_text text not null,
  is_correct boolean not null default false,
  sequence_order integer not null,
  constraint quiz_options_pkey primary key (id),
  constraint quiz_options_question_id_fkey foreign key (question_id) references quiz_questions(id)
);

create table quiz_attempts (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  student_id uuid not null,
  started_at timestamp with time zone not null default now(),
  submitted_at timestamp with time zone,
  score numeric,
  total_points numeric,
  grade_id uuid,
  constraint quiz_attempts_pkey primary key (id),
  constraint quiz_attempts_grade_id_fkey foreign key (grade_id) references grades(id),
  constraint quiz_attempts_quiz_id_fkey foreign key (quiz_id) references quizzes(id),
  constraint quiz_attempts_student_id_fkey foreign key (student_id) references student_profiles(id)
);

create table quiz_answers (
  id uuid not null default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  selected_option_id uuid,
  answered_at timestamp with time zone not null default now(),
  constraint quiz_answers_pkey primary key (id),
  constraint quiz_answers_question_id_fkey foreign key (question_id) references quiz_questions(id),
  constraint quiz_answers_attempt_id_fkey foreign key (attempt_id) references quiz_attempts(id),
  constraint quiz_answers_selected_option_id_fkey foreign key (selected_option_id) references quiz_options(id),
  constraint quiz_answers_attempt_question_unique unique (attempt_id, question_id)
);

create table library_books (
  id uuid not null default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  category text,
  total_copies integer not null default 1,
  available_copies integer not null default 1,
  is_archived boolean not null default false,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint library_books_pkey primary key (id),
  constraint library_books_created_by_fkey foreign key (created_by) references profiles(id)
);

create table library_loans (
  id uuid not null default gen_random_uuid(),
  book_id uuid not null,
  student_id uuid not null,
  borrowed_at timestamp with time zone not null default now(),
  due_at date not null,
  returned_at timestamp with time zone,
  issued_by uuid,
  returned_to uuid,
  created_at timestamp with time zone not null default now(),
  constraint library_loans_pkey primary key (id),
  constraint library_loans_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint library_loans_returned_to_fkey foreign key (returned_to) references profiles(id),
  constraint library_loans_book_id_fkey foreign key (book_id) references library_books(id),
  constraint library_loans_issued_by_fkey foreign key (issued_by) references profiles(id)
);

create table messages (
  id uuid not null default gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  content text not null,
  read boolean default false,
  sent_at timestamp with time zone default now(),
  constraint messages_pkey primary key (id),
  constraint messages_sender_id_fkey foreign key (sender_id) references profiles(id),
  constraint messages_recipient_id_fkey foreign key (recipient_id) references profiles(id)
);

create table report_card_remarks (
  id uuid not null default gen_random_uuid(),
  student_id uuid,
  term integer not null,
  academic_year text not null,
  class_teacher_remark text,
  admin_remark text,
  updated_by uuid,
  updated_at timestamp with time zone default now(),
  constraint report_card_remarks_pkey primary key (id),
  constraint report_card_remarks_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint report_card_remarks_updated_by_fkey foreign key (updated_by) references profiles(id)
);

create table school_settings (
  id integer not null default 1,
  name text not null default 'School Name',
  logo_url text,
  motto text,
  address text,
  current_academic_year text not null,
  current_term integer not null default 1,
  grade_scale jsonb not null default '[{"min": 70, "grade": "A"}, {"min": 60, "grade": "B"}, {"min": 50, "grade": "C"}, {"min": 45, "grade": "D"}, {"min": 40, "grade": "E"}, {"min": 0, "grade": "F"}]'::jsonb,
  updated_at timestamp with time zone default now(),
  current_term_start_date date,
  library_fine_kobo_per_day bigint not null default 0,
  constraint school_settings_pkey primary key (id)
);

create table student_notes (
  id uuid not null default gen_random_uuid(),
  student_id uuid,
  author_id uuid,
  note_type student_note_type not null,
  content text not null,
  visible_to_student boolean default true,
  created_at timestamp with time zone default now(),
  constraint student_notes_pkey primary key (id),
  constraint student_notes_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint student_notes_author_id_fkey foreign key (author_id) references profiles(id)
);

create table testimonials (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  conduct_remark text not null,
  admission_academic_year text not null,
  leaving_academic_year text not null,
  issued_by uuid,
  issued_at timestamp with time zone not null default now(),
  constraint testimonials_pkey primary key (id),
  constraint testimonials_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint testimonials_issued_by_fkey foreign key (issued_by) references profiles(id)
);

create table topic_notes (
  id uuid not null default gen_random_uuid(),
  topic_id uuid,
  author_id uuid,
  content text not null,
  status note_status not null default 'published',
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint topic_notes_pkey primary key (id),
  constraint topic_notes_topic_id_fkey foreign key (topic_id) references curriculum_topics(id),
  constraint topic_notes_author_id_fkey foreign key (author_id) references profiles(id)
);

create table topic_resources (
  id uuid not null default gen_random_uuid(),
  topic_id uuid,
  note_id uuid,
  resource_type text not null,
  title text,
  content text,
  file_url text,
  sequence_order integer default 0,
  uploaded_by uuid,
  created_at timestamp with time zone default now(),
  constraint topic_resources_pkey primary key (id),
  constraint topic_resources_topic_id_fkey foreign key (topic_id) references curriculum_topics(id),
  constraint topic_resources_note_id_fkey foreign key (note_id) references topic_notes(id),
  constraint topic_resources_uploaded_by_fkey foreign key (uploaded_by) references profiles(id)
);

-- ----------------------------------------------------------------------------
-- Helper / security-definer functions (needed by RLS policies below)
-- ----------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function is_bursar()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'bursar'
      and p.is_active = true
  );
$$;

create or replace function is_hod_of_subject(sid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'hod'
      and p.is_active = true
      and sid = any(tp.subjects_taught)
  );
$$;

create or replace function is_house_parent()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'house_parent'
      and p.is_active = true
  );
$$;

create or replace function is_house_parent_of_room(rid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from hostel_rooms hr
    join hostels h on h.id = hr.hostel_id
    where hr.id = rid
      and h.house_parent_id = auth.uid()
  );
$$;

create or replace function student_current_hostel(sid uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select h.id
  from hostel_assignments ha
  join hostel_rooms hr on hr.id = ha.room_id
  join hostels h on h.id = hr.hostel_id
  where ha.student_id = sid
    and ha.unassigned_at is null
  limit 1;
$$;

create or replace function is_house_parent_of_student(sid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from hostels h
    where h.id = student_current_hostel(sid)
      and h.house_parent_id = auth.uid()
  );
$$;

create or replace function is_librarian()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'librarian'
      and p.is_active = true
  );
$$;

create or replace function is_parent_of(sid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from guardian_links
    where parent_id = auth.uid() and student_id = sid
  );
$$;

create or replace function is_quiz_owner(qid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from quizzes q
    join assessments a on a.id = q.assessment_id
    where q.id = qid and a.created_by = auth.uid()
  );
$$;

create or replace function is_self_student(sid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select auth.uid() = sid;
$$;

create or replace function is_transport_officer()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'transport_officer'
      and p.is_active = true
  );
$$;

create or replace function is_driver_of_route(rid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from transport_routes tr
    join vehicles v on v.id = tr.vehicle_id
    where tr.id = rid
      and v.driver_profile_id = auth.uid()
  );
$$;

create or replace function topic_visible_to_parent(t_education_level education_level, t_level_number integer)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from guardian_links gl
    join student_profiles sp on sp.id = gl.student_id
    join classes c on c.id = sp.class_id
    where gl.parent_id = auth.uid()
      and c.education_level = t_education_level
      and c.level_number = t_level_number
  );
$$;

create or replace function topic_visible_to_student(t_education_level education_level, t_level_number integer)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from student_profiles sp
    join classes c on c.id = sp.class_id
    where sp.id = auth.uid()
      and c.education_level = t_education_level
      and c.level_number = t_level_number
  );
$$;

create or replace function topic_note_visible(p_topic_id uuid, p_note_status note_status, p_author_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_education_level education_level;
  v_level_number integer;
begin
  if is_admin() or p_author_id = auth.uid() then
    return true;
  end if;

  if p_note_status <> 'published' then
    return false;
  end if;

  if exists (select 1 from teacher_profiles where id = auth.uid()) then
    return true;
  end if;

  select education_level, level_number
    into v_education_level, v_level_number
    from curriculum_topics
    where id = p_topic_id;

  return topic_visible_to_student(v_education_level, v_level_number)
      or topic_visible_to_parent(v_education_level, v_level_number);
end;
$$;

create or replace function valid_level_number(level education_level, level_number integer)
returns boolean
language sql
immutable
as $$
  select case level
    when 'primary' then level_number between 1 and 6
    when 'jss' then level_number between 1 and 3
    when 'sss' then level_number between 1 and 3
  end;
$$;

create or replace function current_scheme_week()
returns integer
language sql
stable
as $$
  select case
    when current_term_start_date is null then null
    else least(
      greatest(1, (current_date - current_term_start_date) / 7 + 1),
      14
    )
  end
  from school_settings
  where id = 1;
$$;

create or replace function custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_must_change boolean;
begin
  select must_change_password into v_must_change
  from public.profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Default to false if no profile row exists yet (shouldn't normally
  -- happen, but fail safe rather than fail closed here).
  claims := jsonb_set(claims, '{must_change_password}', to_jsonb(coalesce(v_must_change, false)));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- ----------------------------------------------------------------------------
-- Business-logic functions (RPCs)
-- ----------------------------------------------------------------------------

create or replace function answer_quiz_question(p_attempt_id uuid, p_question_id uuid, p_selected_option_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attempt quiz_attempts;
  v_quiz quizzes;
begin
  select * into v_attempt from quiz_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then
    raise exception 'Attempt not found.';
  end if;
  if v_attempt.submitted_at is not null then
    raise exception 'This quiz has already been submitted.';
  end if;

  select * into v_quiz from quizzes where id = v_attempt.quiz_id;
  if now() > v_attempt.started_at + (v_quiz.duration_minutes || ' minutes')::interval then
    raise exception 'Time is up for this quiz attempt.';
  end if;

  if not exists (
    select 1 from quiz_questions where id = p_question_id and quiz_id = v_attempt.quiz_id
  ) then
    raise exception 'That question does not belong to this quiz.';
  end if;
  if not exists (
    select 1 from quiz_options where id = p_selected_option_id and question_id = p_question_id
  ) then
    raise exception 'That option does not belong to this question.';
  end if;

  insert into quiz_answers (attempt_id, question_id, selected_option_id)
  values (p_attempt_id, p_question_id, p_selected_option_id)
  on conflict (attempt_id, question_id)
  do update set selected_option_id = excluded.selected_option_id, answered_at = now();
end;
$$;

create or replace function assign_student_to_hostel_room(p_student_id uuid, p_room_id uuid, p_academic_year text)
returns hostel_assignments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room hostel_rooms%rowtype;
  v_hostel hostels%rowtype;
  v_student_gender text;
  v_occupied integer;
  v_assignment hostel_assignments%rowtype;
begin
  if not (is_admin() or is_house_parent_of_room(p_room_id)) then
    raise exception 'Only an admin or that hostel''s house parent can do this.';
  end if;

  select * into v_room from hostel_rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'Room not found.';
  end if;

  select * into v_hostel from hostels where id = v_room.hostel_id;

  select gender into v_student_gender from student_profiles where id = p_student_id;
  if v_student_gender is not null and v_hostel.gender is not null
     and v_student_gender <> v_hostel.gender then
    raise exception 'This student''s gender does not match this hostel.';
  end if;

  select count(*) into v_occupied from hostel_assignments
    where room_id = p_room_id and unassigned_at is null;
  if v_occupied >= v_room.capacity then
    raise exception 'This room is already at capacity.';
  end if;

  update hostel_assignments set unassigned_at = now()
    where student_id = p_student_id and unassigned_at is null;

  insert into hostel_assignments (student_id, room_id, academic_year, assigned_by)
  values (p_student_id, p_room_id, p_academic_year, auth.uid())
  returning * into v_assignment;

  update hostel_waitlist
    set fulfilled_at = now(), fulfilled_room_id = p_room_id
    where student_id = p_student_id
      and hostel_id = v_room.hostel_id
      and fulfilled_at is null
      and cancelled_at is null;

  return v_assignment;
end;
$$;

create or replace function borrow_library_book(p_book_id uuid, p_student_id uuid, p_due_at date)
returns library_loans
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_available integer;
  v_loan library_loans;
begin
  if not (is_admin() or is_librarian()) then
    raise exception 'Only an admin or librarian can issue a loan.';
  end if;

  if p_due_at <= current_date then
    raise exception 'Due date must be in the future.';
  end if;

  select available_copies into v_available
  from library_books
  where id = p_book_id and not is_archived
  for update;

  if v_available is null then
    raise exception 'Book not found or no longer in the catalog.';
  end if;

  if v_available <= 0 then
    raise exception 'No copies of this book are currently available.';
  end if;

  if exists (
    select 1 from library_loans
    where book_id = p_book_id and student_id = p_student_id and returned_at is null
  ) then
    raise exception 'This student already has an active loan for this book.';
  end if;

  update library_books set available_copies = available_copies - 1 where id = p_book_id;

  insert into library_loans (book_id, student_id, due_at, issued_by)
  values (p_book_id, p_student_id, p_due_at, auth.uid())
  returning * into v_loan;

  return v_loan;
end;
$$;

create or replace function check_grade_score_bounds()
returns trigger
language plpgsql
as $$
declare
  v_max_score numeric;
begin
  if new.score < 0 then
    raise exception 'Score cannot be negative.';
  end if;

  select max_score into v_max_score
  from assessments
  where id = new.assessment_id;

  if v_max_score is null then
    raise exception 'Assessment not found for this grade.';
  end if;

  if new.score > v_max_score then
    raise exception 'Score (%) exceeds this assessment''s max score (%).', new.score, v_max_score;
  end if;

  return new;
end;
$$;

create or replace function check_timetable_conflict()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(
      coalesce(new.class_id::text, '') || '|' ||
      new.weekday::text || '|' ||
      new.period_number::text || '|' ||
      new.academic_year || '|' ||
      new.term::text
    )
  );

  if exists (
    select 1 from timetable_entries
    where class_id = new.class_id
      and weekday = new.weekday
      and period_number = new.period_number
      and academic_year = new.academic_year
      and term = new.term
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'This class already has a lesson in that period.';
  end if;

  if exists (
    select 1 from timetable_entries
    where teacher_id = new.teacher_id
      and weekday = new.weekday
      and period_number = new.period_number
      and academic_year = new.academic_year
      and term = new.term
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'This teacher is already scheduled for another class at that time.';
  end if;

  if new.room is not null and exists (
    select 1 from timetable_entries
    where room = new.room
      and weekday = new.weekday
      and period_number = new.period_number
      and academic_year = new.academic_year
      and term = new.term
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'Room "%" is already booked for that period.', new.room;
  end if;

  return new;
end;
$$;

create or replace function get_quiz_attempt_questions(p_attempt_id uuid)
returns table(question_id uuid, question_text text, points numeric, question_sequence integer, option_id uuid, option_text text, option_sequence integer, selected_option_id uuid)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_attempt quiz_attempts;
begin
  select * into v_attempt from quiz_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then
    raise exception 'Attempt not found.';
  end if;

  return query
  select
    qq.id, qq.question_text, qq.points, qq.sequence_order,
    qo.id, qo.option_text, qo.sequence_order,
    qa.selected_option_id
  from quiz_questions qq
  join quiz_options qo on qo.question_id = qq.id
  left join quiz_answers qa on qa.attempt_id = p_attempt_id and qa.question_id = qq.id
  where qq.quiz_id = v_attempt.quiz_id
  order by qq.sequence_order, qo.sequence_order;
end;
$$;

create or replace function invoice_dashboard_totals(p_academic_year text default null, p_term integer default null)
returns table(total_billed bigint, total_collected bigint, total_outstanding bigint, unpaid_invoice_count bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_academic_year text;
  v_term integer;
begin
  if not (is_admin() or is_bursar()) then
    raise exception 'Not authorized.';
  end if;

  if p_academic_year is null or p_term is null then
    select current_academic_year, current_term
      into v_academic_year, v_term
      from public.school_settings
      where id = 1;
  else
    v_academic_year := p_academic_year;
    v_term := p_term;
  end if;

  return query
  select
    coalesce(sum(i.total_amount_kobo - i.discount_kobo), 0)::bigint,
    coalesce(sum(i.amount_paid_kobo), 0)::bigint,
    coalesce(sum(i.total_amount_kobo - i.discount_kobo - i.amount_paid_kobo), 0)::bigint,
    count(*) filter (where i.status in ('unpaid', 'partial'))::bigint
  from public.invoices i
  where i.academic_year = v_academic_year
    and i.term = v_term;
end;
$$;

create or replace function join_hostel_waitlist(p_student_id uuid, p_hostel_id uuid)
returns hostel_waitlist
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_entry hostel_waitlist%rowtype;
begin
  if not (
    is_admin()
    or exists (select 1 from hostels h where h.id = p_hostel_id and h.house_parent_id = auth.uid())
  ) then
    raise exception 'Only an admin or that hostel''s house parent can do this.';
  end if;

  if exists (
    select 1 from hostel_waitlist
    where student_id = p_student_id and hostel_id = p_hostel_id
      and fulfilled_at is null and cancelled_at is null
  ) then
    raise exception 'This student is already on the waitlist for this hostel.';
  end if;

  insert into hostel_waitlist (student_id, hostel_id, requested_by)
  values (p_student_id, p_hostel_id, auth.uid())
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function log_asset_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'asset', new.id, 'asset_created', auth.uid(),
      jsonb_build_object('name', new.name, 'category', new.category, 'serial_no', new.serial_no)
    );
  elsif tg_op = 'UPDATE' then
    if new.is_archived is distinct from old.is_archived then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values (
        'asset', new.id,
        case when new.is_archived then 'asset_archived' else 'asset_unarchived' end,
        auth.uid(), jsonb_build_object('name', new.name)
      );
    elsif new.condition is distinct from old.condition
       or new.location is distinct from old.location
       or new.assigned_to is distinct from old.assigned_to then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values (
        'asset', new.id, 'asset_updated', auth.uid(),
        jsonb_build_object(
          'name', new.name,
          'old_condition', old.condition, 'new_condition', new.condition,
          'old_location', old.location, 'new_location', new.location,
          'old_assigned_to', old.assigned_to, 'new_assigned_to', new.assigned_to
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('asset', old.id, 'asset_deleted', auth.uid(), jsonb_build_object('name', old.name));
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function log_curriculum_topic_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'curriculum_topic', new.id, 'curriculum_topic_created', auth.uid(),
      jsonb_build_object(
        'title', new.title,
        'subject_id', new.subject_id,
        'education_level', new.education_level,
        'level_number', new.level_number,
        'term', new.term,
        'academic_year', new.academic_year,
        'week_number', new.week_number,
        'sequence_order', new.sequence_order
      )
    );
  elsif tg_op = 'UPDATE' then
    -- Only log the fields that actually matter for scheme-of-work
    -- integrity (the ones a scheduling mistake or bad migration could
    -- silently corrupt), not every incidental column touch.
    if new.week_number is distinct from old.week_number
       or new.term is distinct from old.term
       or new.academic_year is distinct from old.academic_year
       or new.sequence_order is distinct from old.sequence_order
       or new.title is distinct from old.title then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values (
        'curriculum_topic', new.id, 'curriculum_topic_updated', auth.uid(),
        jsonb_build_object(
          'title', new.title,
          'old_week_number', old.week_number, 'new_week_number', new.week_number,
          'old_term', old.term, 'new_term', new.term,
          'old_academic_year', old.academic_year, 'new_academic_year', new.academic_year,
          'old_sequence_order', old.sequence_order, 'new_sequence_order', new.sequence_order,
          'old_title', old.title
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'curriculum_topic', old.id, 'curriculum_topic_deleted', auth.uid(),
      jsonb_build_object('title', old.title, 'subject_id', old.subject_id)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function log_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'enrollment',
    new.id,
    case when tg_op = 'INSERT' then 'enrollment_created' else 'enrollment_updated' end,
    auth.uid(),
    jsonb_build_object(
      'student_id', new.student_id,
      'class_id', new.class_id,
      'academic_year', new.academic_year,
      'term', new.term,
      'old_class_id', case when tg_op = 'UPDATE' then old.class_id else null end
    )
  );
  return new;
end;
$$;

create or replace function log_fee_structure_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'fee_structure', new.id, 'fee_structure_created', auth.uid(),
      jsonb_build_object(
        'title', new.title,
        'education_level', new.education_level,
        'level_number', new.level_number,
        'term', new.term,
        'academic_year', new.academic_year,
        'amount_kobo', new.amount_kobo
      )
    );
  elsif tg_op = 'UPDATE' then
    if new.amount_kobo is distinct from old.amount_kobo then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values (
        'fee_structure', new.id, 'fee_structure_amount_changed', auth.uid(),
        jsonb_build_object(
          'title', new.title,
          'old_amount_kobo', old.amount_kobo,
          'new_amount_kobo', new.amount_kobo
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'fee_structure', old.id, 'fee_structure_deleted', auth.uid(),
      jsonb_build_object('title', old.title, 'amount_kobo', old.amount_kobo)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function log_hostel_assignment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_assignment', new.id, 'hostel_assignment_created', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'room_id', new.room_id,
        'academic_year', new.academic_year)
    );
  elsif tg_op = 'UPDATE' and new.unassigned_at is distinct from old.unassigned_at
        and new.unassigned_at is not null then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_assignment', new.id, 'hostel_assignment_ended', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'room_id', new.room_id)
    );
  end if;
  return new;
end;
$$;

create or replace function log_hostel_fee_structure_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('hostel_fee_structure', new.id, 'hostel_fee_structure_created', auth.uid(),
      jsonb_build_object('hostel_id', new.hostel_id, 'term', new.term,
        'academic_year', new.academic_year, 'amount_kobo', new.amount_kobo));
  elsif tg_op = 'UPDATE' then
    if new.voided_at is distinct from old.voided_at and new.voided_at is not null then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values ('hostel_fee_structure', new.id, 'hostel_fee_structure_voided', auth.uid(),
        jsonb_build_object('hostel_id', new.hostel_id));
    elsif new.amount_kobo is distinct from old.amount_kobo then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values ('hostel_fee_structure', new.id, 'hostel_fee_structure_amount_changed', auth.uid(),
        jsonb_build_object('old_amount_kobo', old.amount_kobo, 'new_amount_kobo', new.amount_kobo));
    end if;
  end if;
  return new;
end;
$$;

create or replace function log_hostel_leave_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_leave_log', new.id, 'hostel_leave_logged', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'reason', new.reason,
        'expected_return_at', new.expected_return_at)
    );
  elsif tg_op = 'UPDATE' and new.returned_at is distinct from old.returned_at
        and new.returned_at is not null then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_leave_log', new.id, 'hostel_return_logged', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'returned_at', new.returned_at)
    );
  end if;
  return new;
end;
$$;

create or replace function log_invoice_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'invoice', new.id, 'invoice_created', auth.uid(),
      jsonb_build_object(
        'student_id', new.student_id,
        'fee_structure_id', new.fee_structure_id,
        'transport_fee_structure_id', new.transport_fee_structure_id,
        'term', new.term,
        'academic_year', new.academic_year,
        'total_amount_kobo', new.total_amount_kobo,
        'discount_kobo', new.discount_kobo
      )
    );
  elsif tg_op = 'UPDATE' then
    if new.discount_kobo is distinct from old.discount_kobo
       or new.total_amount_kobo is distinct from old.total_amount_kobo then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values (
        'invoice', new.id, 'invoice_amount_changed', auth.uid(),
        jsonb_build_object(
          'student_id', new.student_id,
          'old_total_amount_kobo', old.total_amount_kobo,
          'new_total_amount_kobo', new.total_amount_kobo,
          'old_discount_kobo', old.discount_kobo,
          'new_discount_kobo', new.discount_kobo
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'invoice', old.id, 'invoice_deleted', auth.uid(),
      jsonb_build_object(
        'student_id', old.student_id,
        'total_amount_kobo', old.total_amount_kobo,
        'amount_paid_kobo', old.amount_paid_kobo
      )
    );
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function log_quiz_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values ('quiz', new.id, 'quiz_created', auth.uid(),
    jsonb_build_object('assessment_id', new.assessment_id));
  return new;
end;
$$;

create or replace function log_receipt_print(p_payment_id uuid, p_reprint boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.payments where id = p_payment_id) then
    raise exception 'Payment not found.';
  end if;

  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'payment', p_payment_id,
    case when p_reprint then 'receipt_reprinted' else 'receipt_printed' end,
    auth.uid(), '{}'::jsonb
  );
end;
$$;

create or replace function log_route_vehicle_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('route_vehicle_history', new.id, 'vehicle_assigned_to_route', auth.uid(),
      jsonb_build_object('route_id', new.route_id, 'vehicle_id', new.vehicle_id));
  elsif tg_op = 'UPDATE' and new.unassigned_at is distinct from old.unassigned_at
        and new.unassigned_at is not null then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('route_vehicle_history', new.id, 'vehicle_unassigned_from_route', auth.uid(),
      jsonb_build_object('route_id', new.route_id, 'vehicle_id', new.vehicle_id));
  end if;
  return new;
end;
$$;

create or replace function log_testimonial_issued()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'testimonial', new.id, 'testimonial_issued', auth.uid(),
    jsonb_build_object(
      'student_id', new.student_id,
      'admission_academic_year', new.admission_academic_year,
      'leaving_academic_year', new.leaving_academic_year
    )
  );
  return new;
end;
$$;

create or replace function log_transport_assignment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'transport_assignment', new.id, 'transport_assignment_created', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'route_id', new.route_id,
        'stop_id', new.stop_id, 'academic_year', new.academic_year)
    );
  elsif tg_op = 'UPDATE' and new.unassigned_at is distinct from old.unassigned_at
        and new.unassigned_at is not null then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'transport_assignment', new.id, 'transport_assignment_ended', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'route_id', new.route_id)
    );
  end if;
  return new;
end;
$$;

create or replace function log_transport_fee_structure_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('transport_fee_structure', new.id, 'transport_fee_structure_created', auth.uid(),
      jsonb_build_object('route_id', new.route_id, 'term', new.term,
        'academic_year', new.academic_year, 'amount_kobo', new.amount_kobo));
  elsif tg_op = 'UPDATE' then
    if new.voided_at is distinct from old.voided_at and new.voided_at is not null then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values ('transport_fee_structure', new.id, 'transport_fee_structure_voided', auth.uid(),
        jsonb_build_object('route_id', new.route_id));
    elsif new.amount_kobo is distinct from old.amount_kobo then
      insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      values ('transport_fee_structure', new.id, 'transport_fee_structure_amount_changed', auth.uid(),
        jsonb_build_object('old_amount_kobo', old.amount_kobo, 'new_amount_kobo', new.amount_kobo));
    end if;
  end if;
  return new;
end;
$$;

create or replace function log_transport_trip_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'transport_trip_status', new.id, 'transport_trip_status_set', auth.uid(),
      jsonb_build_object('route_id', new.route_id, 'trip_date', new.trip_date,
        'direction', new.direction, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'transport_trip_status', new.id, 'transport_trip_status_set', auth.uid(),
      jsonb_build_object('route_id', new.route_id, 'trip_date', new.trip_date,
        'direction', new.direction, 'old_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function log_vehicle_driver_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.driver_profile_id is distinct from old.driver_profile_id then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values ('vehicle', new.id, 'vehicle_driver_changed', auth.uid(),
      jsonb_build_object(
        'old_driver_profile_id', old.driver_profile_id,
        'new_driver_profile_id', new.driver_profile_id
      ));
  end if;
  return new;
end;
$$;

create or replace function protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Changing role is not permitted.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Changing is_active is not permitted.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function protect_student_profile_class()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.class_id is distinct from old.class_id then
      raise exception 'Changing class_id is not permitted.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function protect_teacher_profile_staff_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.staff_role is distinct from old.staff_role then
      raise exception 'Changing staff_role is not permitted.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function protect_teacher_profile_subjects()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.subjects_taught is distinct from old.subjects_taught then
      raise exception 'Changing subjects_taught is not permitted.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function record_invoice_payment(
  p_invoice_id uuid,
  p_amount_kobo bigint,
  p_method text,
  p_reference text default null,
  p_verified_by uuid default null,
  p_enforce_balance boolean default false
)
returns table(payment_id uuid, student_id uuid, amount_paid_kobo bigint, status invoice_status, already_recorded boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invoice public.invoices%rowtype;
  v_existing_payment public.payments%rowtype;
  v_payment_id uuid;
  v_new_paid bigint;
  v_status public.invoice_status;
  v_balance bigint;
  v_recorded_by uuid := auth.uid();
begin
  if p_amount_kobo <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_method not in ('cash', 'bank_transfer', 'card', 'other') then
    raise exception 'Invalid payment method.';
  end if;

  if p_reference is not null then
    perform pg_advisory_xact_lock(hashtext(p_reference));
    select * into v_existing_payment from public.payments where reference = p_reference;

    if found then
      if v_existing_payment.invoice_id <> p_invoice_id then
        raise exception 'This payment reference belongs to another invoice.';
      end if;

      select i.amount_paid_kobo, i.status into amount_paid_kobo, status
      from public.invoices as i where i.id = p_invoice_id;

      payment_id := v_existing_payment.id;
      student_id := v_existing_payment.student_id;
      already_recorded := true;
      return next;
      return;
    end if;
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  v_balance := v_invoice.total_amount_kobo - v_invoice.discount_kobo - v_invoice.amount_paid_kobo;
  if p_enforce_balance and p_amount_kobo > v_balance + 100 then
    raise exception 'The verified payment amount does not match what is owed on this invoice.';
  end if;

  v_new_paid := v_invoice.amount_paid_kobo + p_amount_kobo;
  v_status := case
    when v_new_paid <= 0 then 'unpaid'::public.invoice_status
    when v_new_paid >= v_invoice.total_amount_kobo - v_invoice.discount_kobo then 'paid'::public.invoice_status
    else 'partial'::public.invoice_status
  end;

  insert into public.payments (invoice_id, student_id, amount_kobo, method, reference, verified_by)
  values (p_invoice_id, v_invoice.student_id, p_amount_kobo, p_method, p_reference, p_verified_by)
  returning id into v_payment_id;

  update public.invoices set amount_paid_kobo = v_new_paid, status = v_status where id = p_invoice_id;

  -- Audit entry: who actually submitted this recording action
  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'payment', v_payment_id, 'payment_recorded', v_recorded_by,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'amount_kobo', p_amount_kobo,
      'method', p_method,
      'reference', p_reference,
      'verified_by', p_verified_by,
      'resulting_invoice_status', v_status
    )
  );

  payment_id := v_payment_id;
  student_id := v_invoice.student_id;
  amount_paid_kobo := v_new_paid;
  status := v_status;
  already_recorded := false;
  return next;
end;
$$;

create or replace function return_library_book(p_loan_id uuid)
returns table(id uuid, book_id uuid, student_id uuid, borrowed_at timestamp with time zone, due_at date, returned_at timestamp with time zone, issued_by uuid, returned_to uuid, created_at timestamp with time zone, overdue_days integer, fine_kobo bigint)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_loan library_loans;
  v_overdue_days integer;
  v_fine_kobo bigint := 0;
  v_fine_rate bigint;
  v_academic_year text;
  v_term integer;
  v_education_level education_level;
  v_level_number integer;
  v_fee_structure_id uuid;
begin
  if not (is_admin() or is_librarian()) then
    raise exception 'Only an admin or librarian can record a return.';
  end if;

  select * into v_loan from library_loans where id = p_loan_id for update;

  if v_loan.id is null then
    raise exception 'Loan not found.';
  end if;

  if v_loan.returned_at is not null then
    raise exception 'This loan was already marked returned.';
  end if;

  update library_loans
    set returned_at = now(), returned_to = auth.uid()
    where id = p_loan_id
    returning * into v_loan;

  update library_books set available_copies = available_copies + 1 where id = v_loan.book_id;

  v_overdue_days := greatest(0, (v_loan.returned_at::date - v_loan.due_at));

  if v_overdue_days > 0 then
    select current_academic_year, current_term, library_fine_kobo_per_day
      into v_academic_year, v_term, v_fine_rate
      from school_settings where id = 1;

    if v_fine_rate > 0 then
      v_fine_kobo := v_overdue_days * v_fine_rate;

      select c.education_level, c.level_number
        into v_education_level, v_level_number
        from student_profiles sp
        join classes c on c.id = sp.class_id
        where sp.id = v_loan.student_id;

      -- A student with no class assigned yet can't be invoiced against a
      -- (education_level, level_number)-scoped fee_structure — skip the
      -- fine rather than fail the whole return.
      if v_education_level is not null then
        -- Serialize concurrent returns racing to find-or-create the same
        -- "Library Fine" fee_structure row for this level/term/year.
        perform pg_advisory_xact_lock(
          hashtext('library_fine|' || v_education_level::text || '|' ||
                   v_level_number::text || '|' || v_term::text || '|' || v_academic_year)
        );

        select fs.id into v_fee_structure_id
          from fee_structures fs
          where fs.education_level = v_education_level
            and fs.level_number = v_level_number
            and fs.term = v_term
            and fs.academic_year = v_academic_year
            and fs.title = 'Library Fine'
            and fs.voided_at is null
          limit 1;

        if v_fee_structure_id is null then
          insert into fee_structures (
            education_level, level_number, term, academic_year, title, amount_kobo, created_by
          )
          values (v_education_level, v_level_number, v_term, v_academic_year, 'Library Fine', 0, auth.uid())
          returning fee_structures.id into v_fee_structure_id;
        end if;

        insert into invoices (
          student_id, fee_structure_id, term, academic_year,
          total_amount_kobo, discount_kobo, amount_paid_kobo, status
        )
        values (
          v_loan.student_id, v_fee_structure_id, v_term, v_academic_year,
          v_fine_kobo, 0, 0, 'unpaid'
        );
        -- The existing trg_log_invoice_change trigger fires on this
        -- INSERT automatically, so this fine is already covered by the
        -- audit log without any extra code here.
      else
        v_fine_kobo := 0;
      end if;
    end if;
  end if;

  return query select
    v_loan.id, v_loan.book_id, v_loan.student_id, v_loan.borrowed_at, v_loan.due_at,
    v_loan.returned_at, v_loan.issued_by, v_loan.returned_to, v_loan.created_at,
    v_overdue_days, v_fine_kobo;
end;
$$;

create or replace function rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$$;

create or replace function start_quiz_attempt(p_quiz_id uuid)
returns quiz_attempts
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quiz quizzes;
  v_assessment assessments;
  v_attempt quiz_attempts;
begin
  select * into v_quiz from quizzes where id = p_quiz_id;
  if v_quiz.id is null then
    raise exception 'Quiz not found.';
  end if;
  if not v_quiz.is_published then
    raise exception 'This quiz is not open yet.';
  end if;
  if v_quiz.opens_at is not null and now() < v_quiz.opens_at then
    raise exception 'This quiz has not opened yet.';
  end if;
  if v_quiz.closes_at is not null and now() > v_quiz.closes_at then
    raise exception 'This quiz has closed.';
  end if;

  select * into v_assessment from assessments where id = v_quiz.assessment_id;
  if not exists (
    select 1 from student_profiles sp where sp.id = auth.uid() and sp.class_id = v_assessment.class_id
  ) then
    raise exception 'This quiz is not available to your class.';
  end if;

  select * into v_attempt from quiz_attempts
    where quiz_id = p_quiz_id and student_id = auth.uid();
  if v_attempt.id is not null then
    if v_attempt.submitted_at is not null then
      raise exception 'You have already submitted this quiz.';
    end if;
    return v_attempt;
  end if;

  insert into quiz_attempts (quiz_id, student_id)
  values (p_quiz_id, auth.uid())
  returning * into v_attempt;

  return v_attempt;
end;
$$;

create or replace function submit_quiz_attempt(p_attempt_id uuid)
returns table(score numeric, total_points numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attempt quiz_attempts;
  v_quiz quizzes;
  v_score numeric;
  v_total numeric;
  v_grade_id uuid;
begin
  select * into v_attempt from quiz_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then
    raise exception 'Attempt not found.';
  end if;
  if v_attempt.submitted_at is not null then
    -- Idempotent: a duplicate submit (e.g. a retried auto-submit on
    -- timeout) just returns the already-computed score rather than
    -- erroring or double-counting.
    score := v_attempt.score;
    total_points := v_attempt.total_points;
    return next;
    return;
  end if;

  select * into v_quiz from quizzes where id = v_attempt.quiz_id;

  -- Grace period of 0 here is intentional: submit is the "stop the clock"
  -- action, so a late submit still scores whatever was answered rather than
  -- rejecting outright. Lateness itself doesn't need to block scoring —
  -- answer_quiz_question is what actually prevents new answers after time
  -- is up, so nothing further can be added after the deadline anyway.

  select coalesce(sum(qq.points), 0) into v_total
  from quiz_questions qq where qq.quiz_id = v_attempt.quiz_id;

  select coalesce(sum(qq.points), 0) into v_score
  from quiz_answers qa
  join quiz_questions qq on qq.id = qa.question_id
  join quiz_options qo on qo.id = qa.selected_option_id
  where qa.attempt_id = p_attempt_id and qo.is_correct;

  insert into grades (assessment_id, student_id, score, moderation_status)
  values (v_quiz.assessment_id, v_attempt.student_id, v_score, 'pending')
  returning id into v_grade_id;

  update quiz_attempts
    set submitted_at = now(), score = v_score, total_points = v_total, grade_id = v_grade_id
    where id = p_attempt_id;

  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'quiz_attempt', p_attempt_id, 'quiz_attempt_submitted', auth.uid(),
    jsonb_build_object('quiz_id', v_attempt.quiz_id, 'score', v_score, 'total_points', v_total)
  );

  score := v_score;
  total_points := v_total;
  return next;
end;
$$;

create or replace function sync_student_class_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current_year text;
  v_current_term integer;
begin
  select current_academic_year, current_term
    into v_current_year, v_current_term
    from school_settings
    where id = 1;

  -- Only the enrollment for the *current* term should drive the cached
  -- class_id — don't let a backfilled/historical enrollment overwrite it.
  if new.academic_year = v_current_year and new.term = v_current_term then
    update student_profiles
       set class_id = new.class_id
       where id = new.student_id
         and class_id is distinct from new.class_id;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

create trigger trg_log_asset_change
  after insert or update or delete on assets
  for each row execute function log_asset_change();

create trigger trg_log_curriculum_topic_change
  after insert or update or delete on curriculum_topics
  for each row execute function log_curriculum_topic_change();

create trigger trg_log_enrollment_change
  after insert or update on enrollments
  for each row execute function log_enrollment_change();

create trigger trg_sync_student_class
  after insert or update on enrollments
  for each row execute function sync_student_class_from_enrollment();

create trigger trg_log_fee_structure_change
  after insert or update or delete on fee_structures
  for each row execute function log_fee_structure_change();

create trigger trg_check_grade_score_bounds
  before insert or update on grades
  for each row execute function check_grade_score_bounds();

create trigger trg_log_hostel_assignment_change
  after insert or update on hostel_assignments
  for each row execute function log_hostel_assignment_change();

create trigger trg_log_hostel_fee_structure_change
  after insert or update on hostel_fee_structures
  for each row execute function log_hostel_fee_structure_change();

create trigger trg_log_hostel_leave_change
  after insert or update on hostel_leave_logs
  for each row execute function log_hostel_leave_change();

create trigger trg_log_invoice_change
  after insert or update or delete on invoices
  for each row execute function log_invoice_change();

create trigger protect_profile_privileged_columns
  before update on profiles
  for each row execute function protect_profile_privileged_columns();

create trigger trg_log_quiz_created
  after insert on quizzes
  for each row execute function log_quiz_created();

create trigger trg_log_route_vehicle_change
  after insert or update on route_vehicle_history
  for each row execute function log_route_vehicle_change();

create trigger protect_student_profile_class
  before update on student_profiles
  for each row execute function protect_student_profile_class();

create trigger protect_teacher_profile_staff_role
  before update on teacher_profiles
  for each row execute function protect_teacher_profile_staff_role();

create trigger protect_teacher_profile_subjects
  before update on teacher_profiles
  for each row execute function protect_teacher_profile_subjects();

create trigger trg_log_testimonial_issued
  after insert on testimonials
  for each row execute function log_testimonial_issued();

create trigger trg_check_timetable_conflict
  before insert or update on timetable_entries
  for each row execute function check_timetable_conflict();

create trigger trg_log_transport_assignment_change
  after insert or update on transport_assignments
  for each row execute function log_transport_assignment_change();

create trigger trg_log_transport_fee_structure_change
  after insert or update on transport_fee_structures
  for each row execute function log_transport_fee_structure_change();

create trigger trg_log_transport_trip_status_change
  after insert or update on transport_trip_status
  for each row execute function log_transport_trip_status_change();

create trigger trg_log_vehicle_driver_change
  after update on vehicles
  for each row execute function log_vehicle_driver_change();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table announcements enable row level security;
alter table assessments enable row level security;
alter table assets enable row level security;
alter table attendance enable row level security;
alter table audit_log enable row level security;
alter table classes enable row level security;
alter table conversation_archives enable row level security;
alter table curriculum_topics enable row level security;
alter table enrollments enable row level security;
alter table fee_structures enable row level security;
alter table grades enable row level security;
alter table guardian_links enable row level security;
alter table hostel_assignments enable row level security;
alter table hostel_fee_structures enable row level security;
alter table hostel_leave_logs enable row level security;
alter table hostel_rooms enable row level security;
alter table hostel_waitlist enable row level security;
alter table hostels enable row level security;
alter table invoices enable row level security;
alter table lessons enable row level security;
alter table library_books enable row level security;
alter table library_loans enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;
alter table profile_contacts enable row level security;
alter table profiles enable row level security;
alter table quiz_answers enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_options enable row level security;
alter table quiz_questions enable row level security;
alter table quizzes enable row level security;
alter table report_card_remarks enable row level security;
alter table route_vehicle_history enable row level security;
alter table school_settings enable row level security;
alter table student_notes enable row level security;
alter table student_profiles enable row level security;
alter table subjects enable row level security;
alter table teacher_profiles enable row level security;
alter table testimonials enable row level security;
alter table timetable_entries enable row level security;
alter table topic_notes enable row level security;
alter table topic_resources enable row level security;
alter table transport_assignments enable row level security;
alter table transport_fee_structures enable row level security;
alter table transport_locations enable row level security;
alter table transport_routes enable row level security;
alter table transport_stops enable row level security;
alter table transport_trip_status enable row level security;
alter table vehicles enable row level security;

-- announcements
create policy announcements_select_all on announcements for select to public
  using (auth.role() = 'authenticated');
create policy announcements_write_staff on announcements for insert to public
  with check (is_admin() or (exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid())));

-- assessments
create policy assessments_select_all on assessments for select to public
  using (auth.role() = 'authenticated');
create policy assessments_write_teacher_admin on assessments for all to public
  using (is_admin() or (created_by = auth.uid() and exists (
    select 1 from timetable_entries te
    where te.teacher_id = auth.uid() and te.class_id = assessments.class_id and te.subject_id = assessments.subject_id)))
  with check (is_admin() or (created_by = auth.uid() and exists (
    select 1 from timetable_entries te
    where te.teacher_id = auth.uid() and te.class_id = assessments.class_id and te.subject_id = assessments.subject_id)));

-- assets
create policy assets_select_admin on assets for select to public using (is_admin());
create policy assets_write_admin on assets for all to public using (is_admin()) with check (is_admin());

-- attendance
create policy attendance_insert_assigned_teacher on attendance for insert to public
  with check (is_admin() or exists (select 1 from lessons l where l.id = attendance.lesson_id and l.teacher_id = auth.uid()));
create policy attendance_select_own_or_staff on attendance for select to public
  using (is_self_student(student_id) or is_admin() or marked_by = auth.uid());
create policy attendance_select_parent on attendance for select to public
  using (is_parent_of(student_id));
create policy attendance_update_assigned_teacher on attendance for update to public
  using (is_admin() or exists (select 1 from lessons l where l.id = attendance.lesson_id and l.teacher_id = auth.uid()));

-- audit_log
create policy audit_log_select_staff on audit_log for select to public
  using (is_admin() or is_bursar());

-- classes
create policy classes_select_all on classes for select to public
  using (auth.role() = 'authenticated');
create policy classes_write_admin on classes for all to public using (is_admin());

-- conversation_archives
create policy conversation_archives_owner on conversation_archives for all to public
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- curriculum_topics
create policy topics_select_parent on curriculum_topics for select to public
  using (topic_visible_to_parent(education_level, level_number));
create policy topics_select_staff on curriculum_topics for select to public
  using (is_admin() or exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid()));
create policy topics_select_student on curriculum_topics for select to public
  using (topic_visible_to_student(education_level, level_number));
create policy topics_update_teacher_admin on curriculum_topics for update to public
  using (is_admin() or created_by = auth.uid());
create policy topics_write_teacher_admin on curriculum_topics for insert to public
  with check (is_admin() or exists (
    select 1 from teacher_profiles tp where tp.id = auth.uid() and curriculum_topics.subject_id = any(tp.subjects_taught)));

-- enrollments
create policy enrollments_select on enrollments for select to public
  using (student_id = auth.uid() or is_admin() or exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid()));
create policy enrollments_write_admin on enrollments for all to public using (is_admin());

-- fee_structures
create policy fee_structures_select_all on fee_structures for select to public
  using (auth.role() = 'authenticated');
create policy fee_structures_write_admin on fee_structures for all to public using (is_admin());
create policy fee_structures_write_bursar on fee_structures for all to public using (is_bursar());

-- grades
create policy grades_insert_assigned_teacher on grades for insert to public
  with check (is_admin() or (moderation_status = 'pending' and exists (
    select 1 from assessments a join timetable_entries te on te.class_id = a.class_id and te.subject_id = a.subject_id
    where a.id = grades.assessment_id and te.teacher_id = auth.uid())));
create policy grades_select_class_teacher on grades for select to public
  using (exists (select 1 from assessments a join classes c on c.id = a.class_id
    where a.id = grades.assessment_id and c.class_teacher_id = auth.uid()));
create policy grades_select_hod on grades for select to public
  using (exists (select 1 from assessments a where a.id = grades.assessment_id and is_hod_of_subject(a.subject_id)));
create policy grades_select_own_approved_or_staff on grades for select to public
  using ((student_id = auth.uid() and moderation_status = 'approved') or is_admin() or graded_by = auth.uid());
create policy grades_select_parent on grades for select to public
  using (is_parent_of(student_id) and moderation_status = 'approved');
create policy grades_update_assigned_teacher on grades for update to public
  using (is_admin() or (moderation_status = 'pending' and exists (
    select 1 from assessments a join timetable_entries te on te.class_id = a.class_id and te.subject_id = a.subject_id
    where a.id = grades.assessment_id and te.teacher_id = auth.uid())))
  with check (is_admin() or (moderation_status = 'pending' and exists (
    select 1 from assessments a join timetable_entries te on te.class_id = a.class_id and te.subject_id = a.subject_id
    where a.id = grades.assessment_id and te.teacher_id = auth.uid())));
create policy grades_update_hod on grades for update to public
  using (exists (select 1 from assessments a where a.id = grades.assessment_id and is_hod_of_subject(a.subject_id)))
  with check (exists (select 1 from assessments a where a.id = grades.assessment_id and is_hod_of_subject(a.subject_id)));

-- guardian_links
create policy guardian_links_delete_admin on guardian_links for delete to public using (is_admin());
create policy guardian_links_insert_admin on guardian_links for insert to public with check (is_admin());
create policy guardian_links_select on guardian_links for select to public
  using (parent_id = auth.uid() or is_admin());
create policy guardian_links_update_admin on guardian_links for update to public using (is_admin()) with check (is_admin());

-- hostel_assignments
create policy hostel_assignments_select on hostel_assignments for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or is_house_parent_of_room(room_id));

-- hostel_fee_structures
create policy hostel_fee_structures_select_all on hostel_fee_structures for select to public
  using (auth.role() = 'authenticated');
create policy hostel_fee_structures_write on hostel_fee_structures for all to public
  using (is_admin() or exists (select 1 from hostels h where h.id = hostel_fee_structures.hostel_id and h.house_parent_id = auth.uid()))
  with check (is_admin() or exists (select 1 from hostels h where h.id = hostel_fee_structures.hostel_id and h.house_parent_id = auth.uid()));

-- hostel_leave_logs
create policy hostel_leave_logs_select on hostel_leave_logs for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or is_house_parent_of_student(student_id));
create policy hostel_leave_logs_write on hostel_leave_logs for all to public
  using (is_admin() or is_house_parent_of_student(student_id))
  with check (is_admin() or is_house_parent_of_student(student_id));

-- hostel_rooms
create policy hostel_rooms_select_all on hostel_rooms for select to public
  using (auth.role() = 'authenticated');
create policy hostel_rooms_write_admin on hostel_rooms for all to public using (is_admin()) with check (is_admin());

-- hostel_waitlist
create policy hostel_waitlist_select on hostel_waitlist for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or exists (
    select 1 from hostels h where h.id = hostel_waitlist.hostel_id and h.house_parent_id = auth.uid()));

-- hostels
create policy hostels_select_all on hostels for select to public
  using (auth.role() = 'authenticated');
create policy hostels_write_admin on hostels for all to public using (is_admin()) with check (is_admin());

-- invoices
create policy invoices_insert_admin_bursar on invoices for insert to public
  with check (is_admin() or is_bursar());
create policy invoices_select_bursar on invoices for select to public using (is_bursar());
create policy invoices_select_parent on invoices for select to public using (is_parent_of(student_id));
create policy invoices_select_self_or_admin on invoices for select to public
  using (student_id = auth.uid() or is_admin());
create policy invoices_update_admin_bursar on invoices for update to public
  using (is_admin() or is_bursar())
  with check ((is_admin() or is_bursar())
    and amount_paid_kobo = (select i.amount_paid_kobo from invoices i where i.id = invoices.id)
    and status = (select i.status from invoices i where i.id = invoices.id));

-- lessons
create policy lessons_select on lessons for select to public
  using (teacher_id = auth.uid() or is_admin() or exists (
    select 1 from student_profiles sp where sp.id = auth.uid() and sp.class_id = lessons.class_id));
create policy lessons_select_parent on lessons for select to public
  using (exists (select 1 from student_profiles sp join guardian_links gl on gl.student_id = sp.id
    where gl.parent_id = auth.uid() and sp.class_id = lessons.class_id));
create policy lessons_write_teacher_admin on lessons for all to public
  using (teacher_id = auth.uid() or is_admin());

-- library_books
create policy library_books_select_all on library_books for select to public
  using (auth.role() = 'authenticated');
create policy library_books_write_staff on library_books for all to public
  using (is_admin() or is_librarian()) with check (is_admin() or is_librarian());

-- library_loans
create policy library_loans_select_admin on library_loans for select to public using (is_admin());
create policy library_loans_select_librarian on library_loans for select to public using (is_librarian());
create policy library_loans_select_own on library_loans for select to public using (is_self_student(student_id));
create policy library_loans_select_parent on library_loans for select to public using (is_parent_of(student_id));

-- messages
create policy messages_delete_participant on messages for delete to public
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy messages_insert_sender on messages for insert to public
  with check (sender_id = auth.uid());
create policy messages_select_participant on messages for select to public
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy messages_update_recipient on messages for update to public
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- payments
create policy payments_select_bursar on payments for select to public using (is_bursar());
create policy payments_select_parent on payments for select to public using (is_parent_of(student_id));
create policy payments_select_self_or_admin on payments for select to public
  using (student_id = auth.uid() or is_admin());

-- profile_contacts
create policy profile_contacts_select_own_or_admin on profile_contacts for select to public
  using (id = auth.uid() or is_admin());

-- profiles
create policy "Allow auth admin to read profiles for claims" on profiles for select to supabase_auth_admin
  using (true);
create policy profiles_select_own_or_admin on profiles for select to public
  using (id = auth.uid() or is_admin());
create policy profiles_select_staff on profiles for select to public
  using (exists (select 1 from teacher_profiles tp where tp.id = auth.uid()));
create policy profiles_update_admin on profiles for update to public using (is_admin()) with check (is_admin());

-- quiz_answers
create policy quiz_answers_select on quiz_answers for select to public
  using (is_admin() or exists (select 1 from quiz_attempts qa
    where qa.id = quiz_answers.attempt_id and (is_self_student(qa.student_id) or is_quiz_owner(qa.quiz_id))));

-- quiz_attempts
create policy quiz_attempts_select on quiz_attempts for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or is_quiz_owner(quiz_id));
create policy quiz_attempts_write_staff on quiz_attempts for all to public
  using (is_admin() or is_quiz_owner(quiz_id)) with check (is_admin() or is_quiz_owner(quiz_id));

-- quiz_options
create policy quiz_options_select_staff on quiz_options for select to public
  using (is_admin() or exists (select 1 from quiz_questions qq where qq.id = quiz_options.question_id and is_quiz_owner(qq.quiz_id)));
create policy quiz_options_write on quiz_options for all to public
  using (is_admin() or exists (select 1 from quiz_questions qq where qq.id = quiz_options.question_id and is_quiz_owner(qq.quiz_id)))
  with check (is_admin() or exists (select 1 from quiz_questions qq where qq.id = quiz_options.question_id and is_quiz_owner(qq.quiz_id)));

-- quiz_questions
create policy quiz_questions_select_staff on quiz_questions for select to public
  using (is_admin() or is_quiz_owner(quiz_id));
create policy quiz_questions_write on quiz_questions for all to public
  using (is_admin() or is_quiz_owner(quiz_id)) with check (is_admin() or is_quiz_owner(quiz_id));

-- quizzes
create policy quizzes_select on quizzes for select to public
  using (is_admin() or is_quiz_owner(id) or (is_published and exists (
    select 1 from assessments a join student_profiles sp on sp.class_id = a.class_id
    where a.id = quizzes.assessment_id and sp.id = auth.uid())));
create policy quizzes_write on quizzes for all to public
  using (is_admin() or exists (select 1 from assessments a where a.id = quizzes.assessment_id and a.created_by = auth.uid()))
  with check (is_admin() or exists (select 1 from assessments a where a.id = quizzes.assessment_id and a.created_by = auth.uid()));

-- report_card_remarks
create policy remarks_select on report_card_remarks for select to public
  using (student_id = auth.uid() or is_admin() or exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid()));
create policy remarks_select_parent on report_card_remarks for select to public
  using (is_parent_of(student_id));
create policy remarks_write_staff on report_card_remarks for all to public
  using (is_admin() or exists (select 1 from student_profiles sp join timetable_entries te on te.class_id = sp.class_id
    where sp.id = report_card_remarks.student_id and te.teacher_id = auth.uid()));

-- route_vehicle_history
create policy route_vehicle_history_select on route_vehicle_history for select to public
  using (is_admin() or is_transport_officer());
create policy route_vehicle_history_write on route_vehicle_history for all to public
  using (is_admin() or is_transport_officer()) with check (is_admin() or is_transport_officer());

-- school_settings
create policy settings_select_all on school_settings for select to public
  using (auth.role() = 'authenticated');
create policy settings_write_admin on school_settings for update to public using (is_admin());

-- student_notes
create policy student_notes_select on student_notes for select to public
  using ((is_self_student(student_id) and visible_to_student) or is_admin() or author_id = auth.uid());
create policy student_notes_write_staff on student_notes for insert to public
  with check (is_admin() or exists (select 1 from student_profiles sp join timetable_entries te on te.class_id = sp.class_id
    where sp.id = student_notes.student_id and te.teacher_id = auth.uid()));

-- student_profiles
create policy student_profiles_insert_admin on student_profiles for insert to public with check (is_admin());
create policy student_profiles_select on student_profiles for select to public
  using (id = auth.uid() or is_admin() or exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid()));
create policy student_profiles_update_admin on student_profiles for update to public using (is_admin()) with check (is_admin());

-- subjects
create policy subjects_select_all on subjects for select to public
  using (auth.role() = 'authenticated');
create policy subjects_write_admin on subjects for all to public using (is_admin());

-- teacher_profiles
create policy teacher_profiles_insert_admin on teacher_profiles for insert to public with check (is_admin());
create policy teacher_profiles_select_all on teacher_profiles for select to public
  using (auth.role() = 'authenticated');
create policy teacher_profiles_update_admin on teacher_profiles for update to public using (is_admin()) with check (is_admin());

-- testimonials
create policy testimonials_select on testimonials for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or exists (
    select 1 from teacher_profiles where teacher_profiles.id = auth.uid()));
create policy testimonials_write_admin on testimonials for all to public using (is_admin()) with check (is_admin());

-- timetable_entries
create policy timetable_select_own_class on timetable_entries for select to public
  using (is_admin() or teacher_id = auth.uid() or exists (
    select 1 from student_profiles sp where sp.id = auth.uid() and sp.class_id = timetable_entries.class_id));
create policy timetable_select_parent on timetable_entries for select to public
  using (exists (select 1 from student_profiles sp join guardian_links gl on gl.student_id = sp.id
    where gl.parent_id = auth.uid() and sp.class_id = timetable_entries.class_id));
create policy timetable_write_admin on timetable_entries for all to public using (is_admin());

-- topic_notes
create policy notes_select_scoped on topic_notes for select to public
  using (topic_note_visible(topic_id, status, author_id));
create policy notes_update_own_or_admin on topic_notes for update to public
  using (is_admin() or author_id = auth.uid() or exists (
    select 1 from curriculum_topics ct join teacher_profiles tp on tp.id = auth.uid()
    where ct.id = topic_notes.topic_id and ct.subject_id = any(tp.subjects_taught)));
create policy notes_write_teacher_admin on topic_notes for insert to public
  with check (is_admin() or exists (
    select 1 from curriculum_topics ct join teacher_profiles tp on tp.id = auth.uid()
    where ct.id = topic_notes.topic_id and ct.subject_id = any(tp.subjects_taught)));

-- topic_resources
create policy resources_select_scoped on topic_resources for select to public
  using ((note_id is not null and exists (
    select 1 from topic_notes n where n.id = topic_resources.note_id and topic_note_visible(n.topic_id, n.status, n.author_id)))
    or note_id is null);
create policy resources_write_teacher_admin on topic_resources for insert to public
  with check (is_admin() or (note_id is not null and exists (
    select 1 from topic_notes n join curriculum_topics ct on ct.id = n.topic_id join teacher_profiles tp on tp.id = auth.uid()
    where n.id = topic_resources.note_id and ct.subject_id = any(tp.subjects_taught)))
    or (note_id is null and exists (select 1 from teacher_profiles where teacher_profiles.id = auth.uid())));

-- transport_assignments
create policy transport_assignments_select on transport_assignments for select to public
  using (is_self_student(student_id) or is_parent_of(student_id) or is_admin() or is_transport_officer() or is_driver_of_route(route_id));
create policy transport_assignments_write on transport_assignments for all to public
  using (is_admin() or is_transport_officer()) with check (is_admin() or is_transport_officer());

-- transport_fee_structures
create policy transport_fee_structures_select_all on transport_fee_structures for select to public
  using (auth.role() = 'authenticated');
create policy transport_fee_structures_write on transport_fee_structures for all to public
  using (is_admin() or is_bursar() or is_transport_officer())
  with check (is_admin() or is_bursar() or is_transport_officer());

-- transport_locations
create policy transport_locations_select_all on transport_locations for select to public
  using (auth.role() = 'authenticated');
create policy transport_locations_write on transport_locations for insert to public
  with check (is_admin() or is_transport_officer() or is_driver_of_route(route_id));

-- transport_routes
create policy transport_routes_select_all on transport_routes for select to public
  using (auth.role() = 'authenticated');
create policy transport_routes_write on transport_routes for all to public
  using (is_admin() or is_transport_officer()) with check (is_admin() or is_transport_officer());

-- transport_stops
create policy transport_stops_select_all on transport_stops for select to public
  using (auth.role() = 'authenticated');
create policy transport_stops_write on transport_stops for all to public
  using (is_admin() or is_transport_officer()) with check (is_admin() or is_transport_officer());

-- transport_trip_status
create policy transport_trip_status_select_all on transport_trip_status for select to public
  using (auth.role() = 'authenticated');
create policy transport_trip_status_write on transport_trip_status for all to public
  using (is_admin() or is_transport_officer() or is_driver_of_route(route_id))
  with check (is_admin() or is_transport_officer() or is_driver_of_route(route_id));

-- vehicles
create policy vehicles_select on vehicles for select to public
  using (is_admin() or is_transport_officer() or driver_profile_id = auth.uid());
create policy vehicles_write on vehicles for all to public
  using (is_admin() or is_transport_officer()) with check (is_admin() or is_transport_officer());
