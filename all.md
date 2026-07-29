| ddl                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE TABLE announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL,
  class_id uuid,
  created_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid,
  class_id uuid,
  title text NOT NULL,
  max_score numeric NOT NULL,
  weight_percent numeric,
  term integer NOT NULL,
  academic_year text NOT NULL,
  created_by uuid,
  assessment_type USER-DEFINED NOT NULL DEFAULT 'other'::assessment_type
);                                                                                                                                                                                                                                                                          |
| CREATE TABLE assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  serial_no text,
  condition USER-DEFINED NOT NULL DEFAULT 'good'::asset_condition,
  location text,
  assigned_to text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                           |
| CREATE TABLE attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid,
  student_id uuid,
  status USER-DEFINED NOT NULL,
  marked_by uuid,
  marked_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE TABLE audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  arm text,
  class_teacher_id uuid,
  academic_year text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  education_level USER-DEFINED NOT NULL,
  level_number integer NOT NULL,
  is_archived boolean NOT NULL DEFAULT false
);                                                                                                                                                                                                                                                                               |
| CREATE TABLE conversation_archives (
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE curriculum_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid,
  term integer NOT NULL,
  title text NOT NULL,
  description text,
  sequence_order integer NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  education_level USER-DEFINED NOT NULL,
  level_number integer NOT NULL,
  academic_year text NOT NULL,
  week_number integer NOT NULL
);                                                                                                                                                                                                 |
| CREATE TABLE enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  academic_year text NOT NULL,
  term integer NOT NULL,
  enrolled_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE fee_structures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  education_level USER-DEFINED NOT NULL,
  level_number integer NOT NULL,
  term integer NOT NULL,
  academic_year text NOT NULL,
  title text NOT NULL,
  amount_kobo bigint NOT NULL,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid
);                                                                                                                                                                                                      |
| CREATE TABLE grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid,
  student_id uuid,
  score numeric NOT NULL,
  remark text,
  graded_by uuid,
  graded_at timestamp with time zone DEFAULT now(),
  moderation_status text NOT NULL DEFAULT 'pending'::text
);                                                                                                                                                                                                                                                                                                                                    |
| CREATE TABLE guardian_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid,
  student_id uuid,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE homework_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  student_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted'::text,
  teacher_remark text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone
);                                                                                                                                                                                                                                 |
| CREATE TABLE hostel_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  room_id uuid NOT NULL,
  academic_year text NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid
);                                                                                                                                                                                                                                                                                                                          |
| CREATE TABLE hostel_fee_structures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  term integer NOT NULL,
  academic_year text NOT NULL,
  title text NOT NULL DEFAULT 'Hostel Fee'::text,
  amount_kobo bigint NOT NULL,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid
);                                                                                                                                                                                                          |
| CREATE TABLE hostel_leave_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  reason text,
  out_at timestamp with time zone NOT NULL DEFAULT now(),
  expected_return_at timestamp with time zone,
  returned_at timestamp with time zone,
  logged_by uuid,
  returned_logged_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                     |
| CREATE TABLE hostel_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  room_number text NOT NULL,
  capacity integer NOT NULL DEFAULT 4,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE TABLE hostel_visitor_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  visitor_name text NOT NULL,
  visitor_phone text,
  relationship text,
  purpose text,
  checked_in_at timestamp with time zone NOT NULL DEFAULT now(),
  checked_out_at timestamp with time zone,
  logged_by uuid,
  checked_out_logged_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                           |
| CREATE TABLE hostel_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  requested_by uuid,
  fulfilled_at timestamp with time zone,
  fulfilled_room_id uuid,
  cancelled_at timestamp with time zone
);                                                                                                                                                                                                                                                                                      |
| CREATE TABLE hostels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL,
  house_parent_id uuid,
  capacity integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  fee_structure_id uuid,
  term integer NOT NULL,
  academic_year text NOT NULL,
  total_amount_kobo bigint NOT NULL,
  discount_kobo bigint NOT NULL DEFAULT 0,
  amount_paid_kobo bigint NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'unpaid'::invoice_status,
  created_at timestamp with time zone DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  transport_fee_structure_id uuid,
  hostel_fee_structure_id uuid,
  last_reminded_at timestamp with time zone
); |
| CREATE TABLE lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timetable_entry_id uuid,
  topic_id uuid,
  class_id uuid,
  teacher_id uuid,
  lesson_date date NOT NULL,
  objectives text,
  homework text,
  created_at timestamp with time zone DEFAULT now(),
  homework_status USER-DEFINED NOT NULL DEFAULT 'given'::homework_status
);                                                                                                                                                                                                                                                                      |
| CREATE TABLE library_books (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  total_copies integer NOT NULL DEFAULT 1,
  available_copies integer NOT NULL DEFAULT 1,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                   |
| CREATE TABLE library_loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  student_id uuid NOT NULL,
  borrowed_at timestamp with time zone NOT NULL DEFAULT now(),
  due_at date NOT NULL,
  returned_at timestamp with time zone,
  issued_by uuid,
  returned_to uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                        |
| CREATE TABLE messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  content text NOT NULL,
  read boolean DEFAULT false,
  sent_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  student_id uuid,
  amount_kobo bigint NOT NULL,
  method text NOT NULL,
  reference text,
  verified_by uuid,
  paid_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                |
| CREATE TABLE profile_contacts (
  id uuid NOT NULL,
  email text NOT NULL,
  phone text
);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE profiles (
  id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  must_change_password boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true
);                                                                                                                                                                                                                                                                                                                                             |
| CREATE TABLE quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_option_id uuid,
  answered_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE TABLE quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  student_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  score numeric,
  total_points numeric,
  grade_id uuid
);                                                                                                                                                                                                                                                                                                                          |
| CREATE TABLE quiz_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sequence_order integer NOT NULL
);                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE TABLE quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  points numeric NOT NULL DEFAULT 1,
  sequence_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  duration_minutes integer NOT NULL,
  opens_at timestamp with time zone,
  closes_at timestamp with time zone,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                          |
| CREATE TABLE report_card_remarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  term integer NOT NULL,
  academic_year text NOT NULL,
  class_teacher_remark text,
  admin_remark text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE route_vehicle_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid
);                                                                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE school_settings (
  id integer NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT 'School Name'::text,
  logo_url text,
  motto text,
  address text,
  current_academic_year text NOT NULL,
  current_term integer NOT NULL DEFAULT 1,
  grade_scale jsonb NOT NULL DEFAULT '[{"min": 70, "grade": "A"}, {"min": 60, "grade": "B"}, {"min": 50, "grade": "C"}, {"min": 45, "grade": "D"}, {"min": 40, "grade": "E"}, {"min": 0, "grade": "F"}]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  current_term_start_date date,
  library_fine_kobo_per_day bigint NOT NULL DEFAULT 0
);           |
| CREATE TABLE student_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  author_id uuid,
  note_type USER-DEFINED NOT NULL,
  content text NOT NULL,
  visible_to_student boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE student_profiles (
  id uuid NOT NULL,
  admission_no text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  class_id uuid,
  gender text
);                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE TABLE subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  education_level USER-DEFINED NOT NULL,
  min_level_number integer NOT NULL,
  max_level_number integer NOT NULL
);                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE TABLE teacher_profiles (
  id uuid NOT NULL,
  staff_id text,
  subjects_taught ARRAY,
  hire_date date,
  staff_role USER-DEFINED NOT NULL DEFAULT 'teacher'::staff_role
);                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE TABLE testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  conduct_remark text NOT NULL,
  admission_academic_year text NOT NULL,
  leaving_academic_year text NOT NULL,
  issued_by uuid,
  issued_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                      |
| CREATE TABLE timetable_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid,
  subject_id uuid,
  teacher_id uuid,
  weekday integer NOT NULL,
  period_number integer NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  room text,
  academic_year text NOT NULL,
  term integer NOT NULL
);                                                                                                                                                                                                                                                        |
| CREATE TABLE topic_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  topic_id uuid,
  author_id uuid,
  content text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'published'::note_status,
  version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  moderation_status text NOT NULL DEFAULT 'approved'::text
);                                                                                                                                                                                                                  |
| CREATE TABLE topic_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  topic_id uuid,
  note_id uuid,
  resource_type text NOT NULL,
  title text,
  content text,
  file_url text,
  sequence_order integer DEFAULT 0,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);                                                                                                                                                                                                                                                                                                                  |
| CREATE TABLE transport_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  route_id uuid NOT NULL,
  stop_id uuid NOT NULL,
  academic_year text NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  unassigned_at timestamp with time zone,
  assigned_by uuid
);                                                                                                                                                                                                                                                                                             |
| CREATE TABLE transport_fee_structures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  term integer NOT NULL,
  academic_year text NOT NULL,
  title text NOT NULL DEFAULT 'Transport Fee'::text,
  amount_kobo bigint NOT NULL,
  due_date date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  voided_at timestamp with time zone,
  voided_by uuid
);                                                                                                                                                                                                     |
| CREATE TABLE transport_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  trip_date date NOT NULL,
  direction text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid
);                                                                                                                                                                                                                                                                                                     |
| CREATE TABLE transport_pickup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  route_id uuid NOT NULL,
  trip_date date NOT NULL,
  direction text NOT NULL,
  picked_up_at timestamp with time zone,
  dropped_off_at timestamp with time zone,
  marked_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                        |
| CREATE TABLE transport_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  vehicle_id uuid,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE TABLE transport_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  name text NOT NULL,
  sequence_order integer NOT NULL,
  approx_time time without time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                                                       |
| CREATE TABLE transport_trip_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  trip_date date NOT NULL,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'not_started'::text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);                                                                                                                                                                                                                                                                                                                   |
| CREATE TABLE vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plate_number text NOT NULL,
  model text,
  capacity integer NOT NULL,
  driver_name text,
  driver_phone text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  driver_profile_id uuid
);                                                                                                                                                                                                                                                                                             |

| table_name            | constraint_type | column_name                | references_table         | references_column |
| --------------------- | --------------- | -------------------------- | ------------------------ | ----------------- |
| announcements         | FOREIGN KEY     | author_id                  | profiles                 | id                |
| announcements         | FOREIGN KEY     | class_id                   | classes                  | id                |
| announcements         | PRIMARY KEY     | id                         | null                     | null              |
| assessments           | PRIMARY KEY     | id                         | null                     | null              |
| assessments           | FOREIGN KEY     | subject_id                 | subjects                 | id                |
| assessments           | FOREIGN KEY     | class_id                   | classes                  | id                |
| assessments           | FOREIGN KEY     | created_by                 | teacher_profiles         | id                |
| assets                | PRIMARY KEY     | id                         | null                     | null              |
| assets                | FOREIGN KEY     | created_by                 | profiles                 | id                |
| attendance            | FOREIGN KEY     | lesson_id                  | lessons                  | id                |
| attendance            | PRIMARY KEY     | id                         | null                     | null              |
| attendance            | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| attendance            | FOREIGN KEY     | marked_by                  | teacher_profiles         | id                |
| audit_log             | PRIMARY KEY     | id                         | null                     | null              |
| audit_log             | FOREIGN KEY     | actor_id                   | profiles                 | id                |
| classes               | PRIMARY KEY     | id                         | null                     | null              |
| classes               | FOREIGN KEY     | class_teacher_id           | teacher_profiles         | id                |
| conversation_archives | PRIMARY KEY     | partner_id                 | null                     | null              |
| conversation_archives | FOREIGN KEY     | user_id                    | profiles                 | id                |
| conversation_archives | FOREIGN KEY     | partner_id                 | profiles                 | id                |
| conversation_archives | PRIMARY KEY     | user_id                    | null                     | null              |
| curriculum_topics     | PRIMARY KEY     | id                         | null                     | null              |
| curriculum_topics     | FOREIGN KEY     | subject_id                 | subjects                 | id                |
| curriculum_topics     | FOREIGN KEY     | created_by                 | profiles                 | id                |
| enrollments           | FOREIGN KEY     | class_id                   | classes                  | id                |
| enrollments           | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| enrollments           | PRIMARY KEY     | id                         | null                     | null              |
| fee_structures        | FOREIGN KEY     | voided_by                  | profiles                 | id                |
| fee_structures        | PRIMARY KEY     | id                         | null                     | null              |
| fee_structures        | FOREIGN KEY     | created_by                 | profiles                 | id                |
| grades                | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| grades                | FOREIGN KEY     | graded_by                  | teacher_profiles         | id                |
| grades                | PRIMARY KEY     | id                         | null                     | null              |
| grades                | FOREIGN KEY     | assessment_id              | assessments              | id                |
| guardian_links        | PRIMARY KEY     | id                         | null                     | null              |
| guardian_links        | FOREIGN KEY     | parent_id                  | profiles                 | id                |
| guardian_links        | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| homework_submissions  | FOREIGN KEY     | lesson_id                  | lessons                  | id                |
| homework_submissions  | FOREIGN KEY     | reviewed_by                | teacher_profiles         | id                |
| homework_submissions  | PRIMARY KEY     | id                         | null                     | null              |
| homework_submissions  | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| hostel_assignments    | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| hostel_assignments    | FOREIGN KEY     | assigned_by                | profiles                 | id                |
| hostel_assignments    | FOREIGN KEY     | room_id                    | hostel_rooms             | id                |
| hostel_assignments    | PRIMARY KEY     | id                         | null                     | null              |
| hostel_fee_structures | FOREIGN KEY     | hostel_id                  | hostels                  | id                |
| hostel_fee_structures | PRIMARY KEY     | id                         | null                     | null              |
| hostel_fee_structures | FOREIGN KEY     | voided_by                  | profiles                 | id                |
| hostel_fee_structures | FOREIGN KEY     | created_by                 | profiles                 | id                |
| hostel_leave_logs     | FOREIGN KEY     | returned_logged_by         | profiles                 | id                |
| hostel_leave_logs     | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| hostel_leave_logs     | FOREIGN KEY     | logged_by                  | profiles                 | id                |
| hostel_leave_logs     | PRIMARY KEY     | id                         | null                     | null              |
| hostel_rooms          | PRIMARY KEY     | id                         | null                     | null              |
| hostel_rooms          | FOREIGN KEY     | hostel_id                  | hostels                  | id                |
| hostel_visitor_logs   | FOREIGN KEY     | logged_by                  | profiles                 | id                |
| hostel_visitor_logs   | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| hostel_visitor_logs   | PRIMARY KEY     | id                         | null                     | null              |
| hostel_visitor_logs   | FOREIGN KEY     | checked_out_logged_by      | profiles                 | id                |
| hostel_waitlist       | PRIMARY KEY     | id                         | null                     | null              |
| hostel_waitlist       | FOREIGN KEY     | requested_by               | profiles                 | id                |
| hostel_waitlist       | FOREIGN KEY     | fulfilled_room_id          | hostel_rooms             | id                |
| hostel_waitlist       | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| hostel_waitlist       | FOREIGN KEY     | hostel_id                  | hostels                  | id                |
| hostels               | PRIMARY KEY     | id                         | null                     | null              |
| hostels               | FOREIGN KEY     | house_parent_id            | teacher_profiles         | id                |
| invoices              | FOREIGN KEY     | transport_fee_structure_id | transport_fee_structures | id                |
| invoices              | PRIMARY KEY     | id                         | null                     | null              |
| invoices              | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| invoices              | FOREIGN KEY     | fee_structure_id           | fee_structures           | id                |
| invoices              | FOREIGN KEY     | voided_by                  | profiles                 | id                |
| invoices              | FOREIGN KEY     | hostel_fee_structure_id    | hostel_fee_structures    | id                |
| lessons               | FOREIGN KEY     | timetable_entry_id         | timetable_entries        | id                |
| lessons               | FOREIGN KEY     | topic_id                   | curriculum_topics        | id                |
| lessons               | FOREIGN KEY     | teacher_id                 | teacher_profiles         | id                |
| lessons               | FOREIGN KEY     | class_id                   | classes                  | id                |
| lessons               | PRIMARY KEY     | id                         | null                     | null              |
| library_books         | PRIMARY KEY     | id                         | null                     | null              |
| library_books         | FOREIGN KEY     | created_by                 | profiles                 | id                |
| library_loans         | FOREIGN KEY     | returned_to                | profiles                 | id                |
| library_loans         | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| library_loans         | FOREIGN KEY     | book_id                    | library_books            | id                |
| library_loans         | PRIMARY KEY     | id                         | null                     | null              |
| library_loans         | FOREIGN KEY     | issued_by                  | profiles                 | id                |
| messages              | FOREIGN KEY     | recipient_id               | profiles                 | id                |
| messages              | PRIMARY KEY     | inserted_at                | null                     | null              |
| messages              | PRIMARY KEY     | id                         | null                     | null              |
| messages              | PRIMARY KEY     | id                         | null                     | null              |
| messages              | FOREIGN KEY     | sender_id                  | profiles                 | id                |
| payments              | FOREIGN KEY     | invoice_id                 | invoices                 | id                |
| payments              | PRIMARY KEY     | id                         | null                     | null              |
| payments              | FOREIGN KEY     | student_id                 | student_profiles         | id                |
| payments              | FOREIGN KEY     | verified_by                | profiles                 | id                |
| profile_contacts      | FOREIGN KEY     | id                         | profiles                 | id                |
| profile_contacts      | PRIMARY KEY     | id                         | null                     | null              |
| profiles              | PRIMARY KEY     | id                         | null                     | null              |
| profiles              | FOREIGN KEY     | id                         | null                     | null              |
| quiz_answers          | FOREIGN KEY     | attempt_id                 | quiz_attempts            | id                |
| quiz_answers          | FOREIGN KEY     | selected_option_id         | quiz_options             | id                |
| quiz_answers          | FOREIGN KEY     | question_id                | quiz_questions           | id                |

| policy_ddl                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE POLICY announcements_select_all ON announcements FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY announcements_write_staff ON announcements FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY assessments_select_all ON assessments FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY assessments_write_teacher_admin ON assessments FOR ALL TO public
  USING ((is_admin() OR ((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM timetable_entries te
  WHERE ((te.teacher_id = auth.uid()) AND (te.class_id = assessments.class_id) AND (te.subject_id = assessments.subject_id)))))))
  WITH CHECK ((is_admin() OR ((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM timetable_entries te
  WHERE ((te.teacher_id = auth.uid()) AND (te.class_id = assessments.class_id) AND (te.subject_id = assessments.subject_id)))))));                                                                                                            |
| CREATE POLICY assets_select_admin ON assets FOR SELECT TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY assets_write_admin ON assets FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY attendance_insert_assigned_teacher ON attendance FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND (l.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY attendance_select_own_or_staff ON attendance FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_admin() OR (marked_by = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY attendance_select_parent ON attendance FOR SELECT TO public
  USING (is_parent_of(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY attendance_update_assigned_teacher ON attendance FOR UPDATE TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND (l.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY audit_log_select_staff ON audit_log FOR SELECT TO public
  USING ((is_admin() OR is_bursar()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY classes_select_all ON classes FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY classes_write_admin ON classes FOR ALL TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY conversation_archives_owner ON conversation_archives FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY topics_select_parent ON curriculum_topics FOR SELECT TO public
  USING (topic_visible_to_parent(education_level, level_number, academic_year, term, week_number));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY topics_select_staff ON curriculum_topics FOR SELECT TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY topics_select_student ON curriculum_topics FOR SELECT TO public
  USING (topic_visible_to_student(education_level, level_number, academic_year, term, week_number));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY topics_update_teacher_admin ON curriculum_topics FOR UPDATE TO public
  USING ((is_admin() OR (created_by = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY topics_write_teacher_admin ON curriculum_topics FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles tp
  WHERE ((tp.id = auth.uid()) AND (curriculum_topics.subject_id = ANY (tp.subjects_taught)))))));                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY enrollments_select ON enrollments FOR SELECT TO public
  USING (((student_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY enrollments_write_admin ON enrollments FOR ALL TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY fee_structures_select_all ON fee_structures FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY fee_structures_write_admin ON fee_structures FOR ALL TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY fee_structures_write_bursar ON fee_structures FOR ALL TO public
  USING (is_bursar());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY grades_insert_assigned_teacher ON grades FOR INSERT TO public
  WITH CHECK ((is_admin() OR ((moderation_status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM (assessments a
     JOIN timetable_entries te ON (((te.class_id = a.class_id) AND (te.subject_id = a.subject_id))))
  WHERE ((a.id = grades.assessment_id) AND (te.teacher_id = auth.uid())))))));                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY grades_select_class_teacher ON grades FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (assessments a
     JOIN classes c ON ((c.id = a.class_id)))
  WHERE ((a.id = grades.assessment_id) AND (c.class_teacher_id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY grades_select_hod ON grades FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM assessments a
  WHERE ((a.id = grades.assessment_id) AND is_hod_of_subject(a.subject_id)))));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY grades_select_own_approved_or_staff ON grades FOR SELECT TO public
  USING ((((student_id = auth.uid()) AND (moderation_status = 'approved'::text)) OR is_admin() OR (graded_by = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY grades_select_parent ON grades FOR SELECT TO public
  USING ((is_parent_of(student_id) AND (moderation_status = 'approved'::text)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY grades_update_assigned_teacher ON grades FOR UPDATE TO public
  USING ((is_admin() OR ((moderation_status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM (assessments a
     JOIN timetable_entries te ON (((te.class_id = a.class_id) AND (te.subject_id = a.subject_id))))
  WHERE ((a.id = grades.assessment_id) AND (te.teacher_id = auth.uid())))))))
  WITH CHECK ((is_admin() OR ((moderation_status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM (assessments a
     JOIN timetable_entries te ON (((te.class_id = a.class_id) AND (te.subject_id = a.subject_id))))
  WHERE ((a.id = grades.assessment_id) AND (te.teacher_id = auth.uid()))))))); |
| CREATE POLICY grades_update_hod ON grades FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM assessments a
  WHERE ((a.id = grades.assessment_id) AND is_hod_of_subject(a.subject_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM assessments a
  WHERE ((a.id = grades.assessment_id) AND is_hod_of_subject(a.subject_id)))));                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY guardian_links_delete_admin ON guardian_links FOR DELETE TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY guardian_links_insert_admin ON guardian_links FOR INSERT TO public
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY guardian_links_select ON guardian_links FOR SELECT TO public
  USING (((parent_id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY guardian_links_update_admin ON guardian_links FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY homework_submissions_insert_self ON homework_submissions FOR INSERT TO public
  WITH CHECK (((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (lessons l
     JOIN student_profiles sp ON ((sp.class_id = l.class_id)))
  WHERE ((l.id = homework_submissions.lesson_id) AND (sp.id = auth.uid()) AND (l.homework IS NOT NULL))))));                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY homework_submissions_select_own_or_staff ON homework_submissions FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = homework_submissions.lesson_id) AND (l.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY homework_submissions_update_owner_pending ON homework_submissions FOR UPDATE TO public
  USING (((student_id = auth.uid()) AND (status = 'submitted'::text)))
  WITH CHECK (((student_id = auth.uid()) AND (status = 'submitted'::text)));                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY homework_submissions_update_teacher_admin ON homework_submissions FOR UPDATE TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = homework_submissions.lesson_id) AND (l.teacher_id = auth.uid()))))))
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = homework_submissions.lesson_id) AND (l.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                  |
| CREATE POLICY hostel_assignments_select ON hostel_assignments FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_house_parent_of_room(room_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY hostel_fee_structures_select_all ON hostel_fee_structures FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY hostel_fee_structures_write ON hostel_fee_structures FOR ALL TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM hostels h
  WHERE ((h.id = hostel_fee_structures.hostel_id) AND (h.house_parent_id = auth.uid()))))))
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM hostels h
  WHERE ((h.id = hostel_fee_structures.hostel_id) AND (h.house_parent_id = auth.uid()))))));                                                                                                                                                                                                                                                                      |
| CREATE POLICY hostel_leave_logs_select ON hostel_leave_logs FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_house_parent_of_student(student_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY hostel_leave_logs_write ON hostel_leave_logs FOR ALL TO public
  USING ((is_admin() OR is_house_parent_of_student(student_id)))
  WITH CHECK ((is_admin() OR is_house_parent_of_student(student_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY hostel_rooms_select_all ON hostel_rooms FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY hostel_rooms_write_admin ON hostel_rooms FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY hostel_visitor_logs_select ON hostel_visitor_logs FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_house_parent_of_student(student_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY hostel_visitor_logs_write ON hostel_visitor_logs FOR ALL TO public
  USING ((is_admin() OR is_house_parent_of_student(student_id)))
  WITH CHECK ((is_admin() OR is_house_parent_of_student(student_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY hostel_waitlist_select ON hostel_waitlist FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR (EXISTS ( SELECT 1
   FROM hostels h
  WHERE ((h.id = hostel_waitlist.hostel_id) AND (h.house_parent_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY hostels_select_all ON hostels FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY hostels_write_admin ON hostels FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY invoices_insert_admin_bursar ON invoices FOR INSERT TO public
  WITH CHECK ((is_admin() OR is_bursar()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE POLICY invoices_select_bursar ON invoices FOR SELECT TO public
  USING (is_bursar());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY invoices_select_parent ON invoices FOR SELECT TO public
  USING (is_parent_of(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY invoices_select_self_or_admin ON invoices FOR SELECT TO public
  USING (((student_id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY invoices_update_admin_bursar ON invoices FOR UPDATE TO public
  USING ((is_admin() OR is_bursar()))
  WITH CHECK (((is_admin() OR is_bursar()) AND (amount_paid_kobo = ( SELECT i.amount_paid_kobo
   FROM invoices i
  WHERE (i.id = invoices.id))) AND (status = ( SELECT i.status
   FROM invoices i
  WHERE (i.id = invoices.id)))));                                                                                                                                                                                                                                                                                                                           |
| CREATE POLICY lessons_select ON lessons FOR SELECT TO public
  USING (((teacher_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM student_profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.class_id = lessons.class_id))))));                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY lessons_select_parent ON lessons FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (student_profiles sp
     JOIN guardian_links gl ON ((gl.student_id = sp.id)))
  WHERE ((gl.parent_id = auth.uid()) AND (sp.class_id = lessons.class_id)))));                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY lessons_write_teacher_admin ON lessons FOR ALL TO public
  USING (((teacher_id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY library_books_select_all ON library_books FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY library_books_write_staff ON library_books FOR ALL TO public
  USING ((is_admin() OR is_librarian()))
  WITH CHECK ((is_admin() OR is_librarian()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY library_loans_select_admin ON library_loans FOR SELECT TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY library_loans_select_librarian ON library_loans FOR SELECT TO public
  USING (is_librarian());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY library_loans_select_own ON library_loans FOR SELECT TO public
  USING (is_self_student(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY library_loans_select_parent ON library_loans FOR SELECT TO public
  USING (is_parent_of(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY messages_delete_participant ON messages FOR DELETE TO public
  USING (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY messages_insert_sender ON messages FOR INSERT TO public
  WITH CHECK ((sender_id = auth.uid()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY messages_select_participant ON messages FOR SELECT TO public
  USING (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY messages_update_recipient ON messages FOR UPDATE TO public
  USING ((recipient_id = auth.uid()))
  WITH CHECK ((recipient_id = auth.uid()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY payments_select_bursar ON payments FOR SELECT TO public
  USING (is_bursar());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY payments_select_parent ON payments FOR SELECT TO public
  USING (is_parent_of(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY payments_select_self_or_admin ON payments FOR SELECT TO public
  USING (((student_id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY profile_contacts_select_own_or_admin ON profile_contacts FOR SELECT TO public
  USING (((id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY "Allow auth admin to read profiles for claims" ON profiles FOR SELECT TO supabase_auth_admin
  USING (true);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY profiles_select_own_or_admin ON profiles FOR SELECT TO public
  USING (((id = auth.uid()) OR is_admin()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY profiles_select_staff ON profiles FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM teacher_profiles tp
  WHERE (tp.id = auth.uid()))));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY profiles_update_admin ON profiles FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY quiz_answers_select ON quiz_answers FOR SELECT TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM quiz_attempts qa
  WHERE ((qa.id = quiz_answers.attempt_id) AND (is_self_student(qa.student_id) OR is_quiz_owner(qa.quiz_id)))))));                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY quiz_attempts_select ON quiz_attempts FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_quiz_owner(quiz_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY quiz_attempts_write_staff ON quiz_attempts FOR ALL TO public
  USING ((is_admin() OR is_quiz_owner(quiz_id)))
  WITH CHECK ((is_admin() OR is_quiz_owner(quiz_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY quiz_options_select_staff ON quiz_options FOR SELECT TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM quiz_questions qq
  WHERE ((qq.id = quiz_options.question_id) AND is_quiz_owner(qq.quiz_id))))));                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY quiz_options_write ON quiz_options FOR ALL TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM quiz_questions qq
  WHERE ((qq.id = quiz_options.question_id) AND is_quiz_owner(qq.quiz_id))))))
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM quiz_questions qq
  WHERE ((qq.id = quiz_options.question_id) AND is_quiz_owner(qq.quiz_id))))));                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY quiz_questions_select_staff ON quiz_questions FOR SELECT TO public
  USING ((is_admin() OR is_quiz_owner(quiz_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY quiz_questions_write ON quiz_questions FOR ALL TO public
  USING ((is_admin() OR is_quiz_owner(quiz_id)))
  WITH CHECK ((is_admin() OR is_quiz_owner(quiz_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY quizzes_select ON quizzes FOR SELECT TO public
  USING ((is_admin() OR is_quiz_owner(id) OR (is_published AND (EXISTS ( SELECT 1
   FROM (assessments a
     JOIN student_profiles sp ON ((sp.class_id = a.class_id)))
  WHERE ((a.id = quizzes.assessment_id) AND (sp.id = auth.uid())))))));                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY quizzes_write ON quizzes FOR ALL TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM assessments a
  WHERE ((a.id = quizzes.assessment_id) AND (a.created_by = auth.uid()))))))
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM assessments a
  WHERE ((a.id = quizzes.assessment_id) AND (a.created_by = auth.uid()))))));                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY remarks_select ON report_card_remarks FOR SELECT TO public
  USING (((student_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY remarks_select_parent ON report_card_remarks FOR SELECT TO public
  USING (is_parent_of(student_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY remarks_write_staff ON report_card_remarks FOR ALL TO public
  USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM (student_profiles sp
     JOIN timetable_entries te ON ((te.class_id = sp.class_id)))
  WHERE ((sp.id = report_card_remarks.student_id) AND (te.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY route_vehicle_history_select ON route_vehicle_history FOR SELECT TO public
  USING ((is_admin() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY route_vehicle_history_write ON route_vehicle_history FOR ALL TO public
  USING ((is_admin() OR is_transport_officer()))
  WITH CHECK ((is_admin() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY settings_select_all ON school_settings FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY settings_write_admin ON school_settings FOR UPDATE TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY student_notes_select ON student_notes FOR SELECT TO public
  USING (((is_self_student(student_id) AND visible_to_student) OR is_admin() OR (author_id = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY student_notes_write_staff ON student_notes FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM (student_profiles sp
     JOIN timetable_entries te ON ((te.class_id = sp.class_id)))
  WHERE ((sp.id = student_notes.student_id) AND (te.teacher_id = auth.uid()))))));                                                                                                                                                                                                                                                                                                                                                                    |
| CREATE POLICY student_profiles_insert_admin ON student_profiles FOR INSERT TO public
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY student_profiles_select ON student_profiles FOR SELECT TO public
  USING (((id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CREATE POLICY student_profiles_update_admin ON student_profiles FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY subjects_select_all ON subjects FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY subjects_write_admin ON subjects FOR ALL TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY teacher_profiles_insert_admin ON teacher_profiles FOR INSERT TO public
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY teacher_profiles_select_all ON teacher_profiles FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY teacher_profiles_update_admin ON teacher_profiles FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY testimonials_select ON testimonials FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid())))));                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY testimonials_write_admin ON testimonials FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CREATE POLICY timetable_select_own_class ON timetable_entries FOR SELECT TO public
  USING ((is_admin() OR (teacher_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM student_profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.class_id = timetable_entries.class_id))))));                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY timetable_select_parent ON timetable_entries FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (student_profiles sp
     JOIN guardian_links gl ON ((gl.student_id = sp.id)))
  WHERE ((gl.parent_id = auth.uid()) AND (sp.class_id = timetable_entries.class_id)))));                                                                                                                                                                                                                                                                                                                                                                                       |
| CREATE POLICY timetable_write_admin ON timetable_entries FOR ALL TO public
  USING (is_admin());                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY notes_select_scoped ON topic_notes FOR SELECT TO public
  USING (topic_note_visible(topic_id, status, author_id, moderation_status));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY notes_update_hod ON topic_notes FOR UPDATE TO public
  USING (is_hod_of_topic(topic_id))
  WITH CHECK (is_hod_of_topic(topic_id));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY notes_update_own_or_admin ON topic_notes FOR UPDATE TO public
  USING ((is_admin() OR (author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (curriculum_topics ct
     JOIN teacher_profiles tp ON ((tp.id = auth.uid())))
  WHERE ((ct.id = topic_notes.topic_id) AND (ct.subject_id = ANY (tp.subjects_taught)))))));                                                                                                                                                                                                                                                                                                                                            |
| CREATE POLICY notes_write_teacher_admin ON topic_notes FOR INSERT TO public
  WITH CHECK ((is_admin() OR (EXISTS ( SELECT 1
   FROM (curriculum_topics ct
     JOIN teacher_profiles tp ON ((tp.id = auth.uid())))
  WHERE ((ct.id = topic_notes.topic_id) AND (ct.subject_id = ANY (tp.subjects_taught)))))));                                                                                                                                                                                                                                                                                                                                                                   |
| CREATE POLICY resources_select_scoped ON topic_resources FOR SELECT TO public
  USING ((((note_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM topic_notes n
  WHERE ((n.id = topic_resources.note_id) AND topic_note_visible(n.topic_id, n.status, n.author_id, n.moderation_status))))) OR (note_id IS NULL)));                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY resources_write_teacher_admin ON topic_resources FOR INSERT TO public
  WITH CHECK ((is_admin() OR ((note_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((topic_notes n
     JOIN curriculum_topics ct ON ((ct.id = n.topic_id)))
     JOIN teacher_profiles tp ON ((tp.id = auth.uid())))
  WHERE ((n.id = topic_resources.note_id) AND (ct.subject_id = ANY (tp.subjects_taught)))))) OR ((note_id IS NULL) AND (EXISTS ( SELECT 1
   FROM teacher_profiles
  WHERE (teacher_profiles.id = auth.uid()))))));                                                                                                                                                     |
| CREATE POLICY transport_assignments_select ON transport_assignments FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY transport_fee_structures_select_all ON transport_fee_structures FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY transport_fee_structures_write ON transport_fee_structures FOR ALL TO public
  USING ((is_admin() OR is_bursar() OR is_transport_officer()))
  WITH CHECK ((is_admin() OR is_bursar() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY transport_locations_select_all ON transport_locations FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| CREATE POLICY transport_locations_write ON transport_locations FOR INSERT TO public
  WITH CHECK ((is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CREATE POLICY transport_pickup_logs_select ON transport_pickup_logs FOR SELECT TO public
  USING ((is_self_student(student_id) OR is_parent_of(student_id) OR is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)));                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CREATE POLICY transport_pickup_logs_write ON transport_pickup_logs FOR ALL TO public
  USING ((is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)))
  WITH CHECK ((is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)));                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY transport_routes_select_all ON transport_routes FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CREATE POLICY transport_routes_write ON transport_routes FOR ALL TO public
  USING ((is_admin() OR is_transport_officer()))
  WITH CHECK ((is_admin() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CREATE POLICY transport_stops_select_all ON transport_stops FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CREATE POLICY transport_stops_write ON transport_stops FOR ALL TO public
  USING ((is_admin() OR is_transport_officer()))
  WITH CHECK ((is_admin() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CREATE POLICY transport_trip_status_select_all ON transport_trip_status FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CREATE POLICY transport_trip_status_write ON transport_trip_status FOR ALL TO public
  USING ((is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)))
  WITH CHECK ((is_admin() OR is_transport_officer() OR is_driver_of_route(route_id)));                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CREATE POLICY vehicles_select ON vehicles FOR SELECT TO public
  USING ((is_admin() OR is_transport_officer() OR (driver_profile_id = auth.uid())));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CREATE POLICY vehicles_write ON vehicles FOR ALL TO public
  USING ((is_admin() OR is_transport_officer()))
  WITH CHECK ((is_admin() OR is_transport_officer()));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

| routine_name                        | function_ddl                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| answer_quiz_question                | CREATE OR REPLACE FUNCTION public.answer_quiz_question(p_attempt_id uuid, p_question_id uuid, p_selected_option_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| assign_student_to_hostel_room       | CREATE OR REPLACE FUNCTION public.assign_student_to_hostel_room(p_student_id uuid, p_room_id uuid, p_academic_year text)
 RETURNS hostel_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| assign_student_to_route             | CREATE OR REPLACE FUNCTION public.assign_student_to_route(p_student_id uuid, p_route_id uuid, p_stop_id uuid, p_academic_year text)
 RETURNS transport_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_route transport_routes%rowtype;
  v_capacity integer;
  v_current_riders integer;
  v_assignment transport_assignments%rowtype;
begin
  if not (is_admin() or is_transport_officer()) then
    raise exception 'Only an admin or the transport officer can do this.';
  end if;

  -- Lock the route row so two concurrent assignments to the same route
  -- can't both pass the capacity check before either commits — mirrors
  -- the "select ... for update" on hostel_rooms in
  -- assign_student_to_hostel_room.
  select * into v_route from transport_routes where id = p_route_id for update;
  if v_route.id is null then
    raise exception 'Route not found.';
  end if;

  if v_route.vehicle_id is not null then
    select capacity into v_capacity from vehicles where id = v_route.vehicle_id;

    -- Only enforced once a vehicle is actually assigned to the route — a
    -- route with no vehicle yet has no known capacity to check against,
    -- so assignment isn't blocked on that basis (just on the route
    -- existing at all). Matches the app's existing behavior.
    if v_capacity is not null then
      select count(*) into v_current_riders
        from transport_assignments
        where route_id = p_route_id and unassigned_at is null;

      if v_current_riders >= v_capacity then
        raise exception 'This route''s vehicle is already at seating capacity.';
      end if;
    end if;
  end if;

  if not exists (select 1 from transport_stops where id = p_stop_id and route_id = p_route_id) then
    raise exception 'That stop does not belong to this route.';
  end if;

  update transport_assignments set unassigned_at = now()
    where student_id = p_student_id and unassigned_at is null;

  insert into transport_assignments (student_id, route_id, stop_id, academic_year, assigned_by)
  values (p_student_id, p_route_id, p_stop_id, p_academic_year, auth.uid())
  returning * into v_assignment;

  return v_assignment;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| borrow_library_book                 | CREATE OR REPLACE FUNCTION public.borrow_library_book(p_book_id uuid, p_student_id uuid, p_due_at date)
 RETURNS library_loans
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_available integer;
  v_loan library_loans;
BEGIN
  IF NOT (is_admin() OR is_librarian()) THEN
    RAISE EXCEPTION 'Only an admin or librarian can issue a loan.';
  END IF;

  IF p_due_at <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Due date must be in the future.';
  END IF;

  SELECT available_copies INTO v_available
  FROM library_books
  WHERE id = p_book_id AND NOT is_archived
  FOR UPDATE;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'Book not found or no longer in the catalog.';
  END IF;

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'No copies of this book are currently available.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM library_loans
    WHERE book_id = p_book_id AND student_id = p_student_id AND returned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This student already has an active loan for this book.';
  END IF;

  UPDATE library_books SET available_copies = available_copies - 1 WHERE id = p_book_id;

  INSERT INTO library_loans (book_id, student_id, due_at, issued_by)
  VALUES (p_book_id, p_student_id, p_due_at, auth.uid())
  RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| check_grade_score_bounds            | CREATE OR REPLACE FUNCTION public.check_grade_score_bounds()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_score numeric;
BEGIN
  IF new.score < 0 THEN
    RAISE EXCEPTION 'Score cannot be negative.';
  END IF;

  SELECT max_score INTO v_max_score
  FROM assessments
  WHERE id = new.assessment_id;

  IF v_max_score IS NULL THEN
    RAISE EXCEPTION 'Assessment not found for this grade.';
  END IF;

  IF new.score > v_max_score THEN
    RAISE EXCEPTION 'Score (%) exceeds this assessment''s max score (%).', new.score, v_max_score;
  END IF;

  RETURN new;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| check_timetable_conflict            | CREATE OR REPLACE FUNCTION public.check_timetable_conflict()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| current_scheme_week                 | CREATE OR REPLACE FUNCTION public.current_scheme_week()
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT CASE
    WHEN current_term_start_date IS NULL THEN NULL
    ELSE LEAST(
      GREATEST(1, (CURRENT_DATE - current_term_start_date) / 7 + 1),
      14
    )
  END
  FROM school_settings
  WHERE id = 1;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| custom_access_token_hook            | CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| get_quiz_attempt_questions          | CREATE OR REPLACE FUNCTION public.get_quiz_attempt_questions(p_attempt_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, points numeric, question_sequence integer, option_id uuid, option_text text, option_sequence integer, selected_option_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| invoice_dashboard_totals            | CREATE OR REPLACE FUNCTION public.invoice_dashboard_totals(p_academic_year text DEFAULT NULL::text, p_term integer DEFAULT NULL::integer)
 RETURNS TABLE(total_billed bigint, total_collected bigint, total_outstanding bigint, unpaid_invoice_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| is_admin                            | CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| is_bursar                           | CREATE OR REPLACE FUNCTION public.is_bursar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM teacher_profiles tp
    JOIN profiles p ON p.id = tp.id
    WHERE tp.id = auth.uid()
      AND tp.staff_role = 'bursar'
      AND p.is_active = true
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| is_driver_of_route                  | CREATE OR REPLACE FUNCTION public.is_driver_of_route(rid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from transport_routes tr
    join vehicles v on v.id = tr.vehicle_id
    where tr.id = rid
      and v.driver_profile_id = auth.uid()
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| is_hod_of_subject                   | CREATE OR REPLACE FUNCTION public.is_hod_of_subject(sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM teacher_profiles tp
    JOIN profiles p ON p.id = tp.id
    WHERE tp.id = auth.uid()
      AND tp.staff_role = 'hod'
      AND p.is_active = true
      AND sid = ANY(tp.subjects_taught)
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| is_hod_of_topic                     | CREATE OR REPLACE FUNCTION public.is_hod_of_topic(p_topic_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from curriculum_topics ct
    where ct.id = p_topic_id
      and is_hod_of_subject(ct.subject_id)
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| is_house_parent                     | CREATE OR REPLACE FUNCTION public.is_house_parent()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'house_parent'
      and p.is_active = true
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| is_house_parent_of_room             | CREATE OR REPLACE FUNCTION public.is_house_parent_of_room(rid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from hostel_rooms hr
    join hostels h on h.id = hr.hostel_id
    where hr.id = rid
      and h.house_parent_id = auth.uid()
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| is_house_parent_of_student          | CREATE OR REPLACE FUNCTION public.is_house_parent_of_student(sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from hostels h
    where h.id = student_current_hostel(sid)
      and h.house_parent_id = auth.uid()
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| is_librarian                        | CREATE OR REPLACE FUNCTION public.is_librarian()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM teacher_profiles tp
    JOIN profiles p ON p.id = tp.id
    WHERE tp.id = auth.uid()
      AND tp.staff_role = 'librarian'
      AND p.is_active = true
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| is_parent_of                        | CREATE OR REPLACE FUNCTION public.is_parent_of(sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from guardian_links
    where parent_id = auth.uid() and student_id = sid
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| is_quiz_owner                       | CREATE OR REPLACE FUNCTION public.is_quiz_owner(qid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from quizzes q
    join assessments a on a.id = q.assessment_id
    where q.id = qid and a.created_by = auth.uid()
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| is_self_student                     | CREATE OR REPLACE FUNCTION public.is_self_student(sid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() = sid;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| is_transport_officer                | CREATE OR REPLACE FUNCTION public.is_transport_officer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'transport_officer'
      and p.is_active = true
  );
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| join_hostel_waitlist                | CREATE OR REPLACE FUNCTION public.join_hostel_waitlist(p_student_id uuid, p_hostel_id uuid)
 RETURNS hostel_waitlist
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| log_asset_change                    | CREATE OR REPLACE FUNCTION public.log_asset_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| log_curriculum_topic_change         | CREATE OR REPLACE FUNCTION public.log_curriculum_topic_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'curriculum_topic', NEW.id, 'curriculum_topic_created', auth.uid(),
      jsonb_build_object(
        'title', NEW.title,
        'subject_id', NEW.subject_id,
        'education_level', NEW.education_level,
        'level_number', NEW.level_number,
        'term', NEW.term,
        'academic_year', NEW.academic_year,
        'week_number', NEW.week_number,
        'sequence_order', NEW.sequence_order
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log the fields that actually matter for scheme-of-work
    -- integrity (the ones a scheduling mistake or bad migration could
    -- silently corrupt), not every incidental column touch.
    IF NEW.week_number IS DISTINCT FROM OLD.week_number
       OR NEW.term IS DISTINCT FROM OLD.term
       OR NEW.academic_year IS DISTINCT FROM OLD.academic_year
       OR NEW.sequence_order IS DISTINCT FROM OLD.sequence_order
       OR NEW.title IS DISTINCT FROM OLD.title THEN
      INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      VALUES (
        'curriculum_topic', NEW.id, 'curriculum_topic_updated', auth.uid(),
        jsonb_build_object(
          'title', NEW.title,
          'old_week_number', OLD.week_number, 'new_week_number', NEW.week_number,
          'old_term', OLD.term, 'new_term', NEW.term,
          'old_academic_year', OLD.academic_year, 'new_academic_year', NEW.academic_year,
          'old_sequence_order', OLD.sequence_order, 'new_sequence_order', NEW.sequence_order,
          'old_title', OLD.title
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'curriculum_topic', OLD.id, 'curriculum_topic_deleted', auth.uid(),
      jsonb_build_object('title', OLD.title, 'subject_id', OLD.subject_id)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| log_enrollment_change               | CREATE OR REPLACE FUNCTION public.log_enrollment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  VALUES (
    'enrollment',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'enrollment_created' ELSE 'enrollment_updated' END,
    auth.uid(),
    jsonb_build_object(
      'student_id', NEW.student_id,
      'class_id', NEW.class_id,
      'academic_year', NEW.academic_year,
      'term', NEW.term,
      'old_class_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.class_id ELSE NULL END
    )
  );
  RETURN NEW;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| log_fee_structure_change            | CREATE OR REPLACE FUNCTION public.log_fee_structure_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'fee_structure', NEW.id, 'fee_structure_created', auth.uid(),
      jsonb_build_object(
        'title', NEW.title,
        'education_level', NEW.education_level,
        'level_number', NEW.level_number,
        'term', NEW.term,
        'academic_year', NEW.academic_year,
        'amount_kobo', NEW.amount_kobo
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount_kobo IS DISTINCT FROM OLD.amount_kobo THEN
      INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      VALUES (
        'fee_structure', NEW.id, 'fee_structure_amount_changed', auth.uid(),
        jsonb_build_object(
          'title', NEW.title,
          'old_amount_kobo', OLD.amount_kobo,
          'new_amount_kobo', NEW.amount_kobo
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'fee_structure', OLD.id, 'fee_structure_deleted', auth.uid(),
      jsonb_build_object('title', OLD.title, 'amount_kobo', OLD.amount_kobo)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| log_homework_submission_change      | CREATE OR REPLACE FUNCTION public.log_homework_submission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'homework_submission', new.id, 'homework_submitted', auth.uid(),
      jsonb_build_object('lesson_id', new.lesson_id, 'student_id', new.student_id)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'reviewed' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'homework_submission', new.id, 'homework_submission_reviewed', auth.uid(),
      jsonb_build_object('lesson_id', new.lesson_id, 'student_id', new.student_id,
        'teacher_remark', new.teacher_remark)
    );
  end if;
  return coalesce(new, old);
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| log_hostel_assignment_change        | CREATE OR REPLACE FUNCTION public.log_hostel_assignment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| log_hostel_fee_structure_change     | CREATE OR REPLACE FUNCTION public.log_hostel_fee_structure_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| log_hostel_leave_change             | CREATE OR REPLACE FUNCTION public.log_hostel_leave_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| log_hostel_visitor_change           | CREATE OR REPLACE FUNCTION public.log_hostel_visitor_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_visitor_log', new.id, 'hostel_visitor_checked_in', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'visitor_name', new.visitor_name,
        'purpose', new.purpose)
    );
  elsif tg_op = 'UPDATE' and new.checked_out_at is distinct from old.checked_out_at
        and new.checked_out_at is not null then
    insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'hostel_visitor_log', new.id, 'hostel_visitor_checked_out', auth.uid(),
      jsonb_build_object('student_id', new.student_id, 'visitor_name', new.visitor_name)
    );
  end if;
  return new;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| log_invoice_change                  | CREATE OR REPLACE FUNCTION public.log_invoice_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'invoice', NEW.id, 'invoice_created', auth.uid(),
      jsonb_build_object(
        'student_id', NEW.student_id,
        'fee_structure_id', NEW.fee_structure_id,
        'transport_fee_structure_id', NEW.transport_fee_structure_id,
        'term', NEW.term,
        'academic_year', NEW.academic_year,
        'total_amount_kobo', NEW.total_amount_kobo,
        'discount_kobo', NEW.discount_kobo
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.discount_kobo IS DISTINCT FROM OLD.discount_kobo
       OR NEW.total_amount_kobo IS DISTINCT FROM OLD.total_amount_kobo THEN
      INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
      VALUES (
        'invoice', NEW.id, 'invoice_amount_changed', auth.uid(),
        jsonb_build_object(
          'student_id', NEW.student_id,
          'old_total_amount_kobo', OLD.total_amount_kobo,
          'new_total_amount_kobo', NEW.total_amount_kobo,
          'old_discount_kobo', OLD.discount_kobo,
          'new_discount_kobo', NEW.discount_kobo
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES (
      'invoice', OLD.id, 'invoice_deleted', auth.uid(),
      jsonb_build_object(
        'student_id', OLD.student_id,
        'total_amount_kobo', OLD.total_amount_kobo,
        'amount_paid_kobo', OLD.amount_paid_kobo
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| log_quiz_created                    | CREATE OR REPLACE FUNCTION public.log_quiz_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  values ('quiz', new.id, 'quiz_created', auth.uid(),
    jsonb_build_object('assessment_id', new.assessment_id));
  return new;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| log_receipt_print                   | CREATE OR REPLACE FUNCTION public.log_receipt_print(p_payment_id uuid, p_reprint boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = p_payment_id) THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;

  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  VALUES (
    'payment', p_payment_id,
    CASE WHEN p_reprint THEN 'receipt_reprinted' ELSE 'receipt_printed' END,
    auth.uid(), '{}'::jsonb
  );
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| log_route_vehicle_change            | CREATE OR REPLACE FUNCTION public.log_route_vehicle_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| log_testimonial_issued              | CREATE OR REPLACE FUNCTION public.log_testimonial_issued()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| log_transport_assignment_change     | CREATE OR REPLACE FUNCTION public.log_transport_assignment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| log_transport_fee_structure_change  | CREATE OR REPLACE FUNCTION public.log_transport_fee_structure_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| log_transport_trip_status_change    | CREATE OR REPLACE FUNCTION public.log_transport_trip_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| log_vehicle_driver_change           | CREATE OR REPLACE FUNCTION public.log_vehicle_driver_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| protect_homework_submission_columns | CREATE OR REPLACE FUNCTION public.protect_homework_submission_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not is_admin() then
    if new.lesson_id is distinct from old.lesson_id
       or new.student_id is distinct from old.student_id then
      raise exception 'Changing lesson_id or student_id is not permitted.';
    end if;
    -- A student (non-teacher, non-admin) may not set status themselves.
    if new.student_id = auth.uid()
       and not exists (select 1 from teacher_profiles tp where tp.id = auth.uid())
       and new.status is distinct from old.status then
      raise exception 'Only a teacher or admin can change submission status.';
    end if;
  end if;
  return new;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| protect_profile_privileged_columns  | CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| protect_student_profile_class       | CREATE OR REPLACE FUNCTION public.protect_student_profile_class()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not is_admin() then
    if new.class_id is distinct from old.class_id then
      raise exception 'Changing class_id is not permitted.';
    end if;
  end if;
  return new;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| protect_teacher_profile_staff_role  | CREATE OR REPLACE FUNCTION public.protect_teacher_profile_staff_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    IF new.staff_role IS DISTINCT FROM old.staff_role THEN
      RAISE EXCEPTION 'Changing staff_role is not permitted.';
    END IF;
  END IF;
  RETURN new;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| protect_teacher_profile_subjects    | CREATE OR REPLACE FUNCTION public.protect_teacher_profile_subjects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not is_admin() then
    if new.subjects_taught is distinct from old.subjects_taught then
      raise exception 'Changing subjects_taught is not permitted.';
    end if;
  end if;
  return new;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| record_invoice_payment              | CREATE OR REPLACE FUNCTION public.record_invoice_payment(p_invoice_id uuid, p_amount_kobo bigint, p_method text, p_reference text DEFAULT NULL::text, p_verified_by uuid DEFAULT NULL::uuid, p_enforce_balance boolean DEFAULT false)
 RETURNS TABLE(payment_id uuid, student_id uuid, amount_paid_kobo bigint, status invoice_status, already_recorded boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_existing_payment public.payments%ROWTYPE;
  v_payment_id uuid;
  v_new_paid bigint;
  v_status public.invoice_status;
  v_balance bigint;
  v_recorded_by uuid := auth.uid();
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  IF p_method NOT IN ('cash', 'bank_transfer', 'card', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method.';
  END IF;

  IF p_reference IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_reference));
    SELECT * INTO v_existing_payment FROM public.payments WHERE reference = p_reference;

    IF FOUND THEN
      IF v_existing_payment.invoice_id <> p_invoice_id THEN
        RAISE EXCEPTION 'This payment reference belongs to another invoice.';
      END IF;

      SELECT i.amount_paid_kobo, i.status INTO amount_paid_kobo, status
      FROM public.invoices AS i WHERE i.id = p_invoice_id;

      payment_id := v_existing_payment.id;
      student_id := v_existing_payment.student_id;
      already_recorded := true;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;

  v_balance := v_invoice.total_amount_kobo - v_invoice.discount_kobo - v_invoice.amount_paid_kobo;
  IF p_enforce_balance AND p_amount_kobo > v_balance + 100 THEN
    RAISE EXCEPTION 'The verified payment amount does not match what is owed on this invoice.';
  END IF;

  v_new_paid := v_invoice.amount_paid_kobo + p_amount_kobo;
  v_status := CASE
    WHEN v_new_paid <= 0 THEN 'unpaid'::public.invoice_status
    WHEN v_new_paid >= v_invoice.total_amount_kobo - v_invoice.discount_kobo THEN 'paid'::public.invoice_status
    ELSE 'partial'::public.invoice_status
  END;

  INSERT INTO public.payments (invoice_id, student_id, amount_kobo, method, reference, verified_by)
  VALUES (p_invoice_id, v_invoice.student_id, p_amount_kobo, p_method, p_reference, p_verified_by)
  RETURNING id INTO v_payment_id;

  UPDATE public.invoices SET amount_paid_kobo = v_new_paid, status = v_status WHERE id = p_invoice_id;

  -- Audit entry: who actually submitted this recording action
  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, metadata)
  VALUES (
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
  RETURN NEXT;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| return_library_book                 | CREATE OR REPLACE FUNCTION public.return_library_book(p_loan_id uuid)
 RETURNS TABLE(id uuid, book_id uuid, student_id uuid, borrowed_at timestamp with time zone, due_at date, returned_at timestamp with time zone, issued_by uuid, returned_to uuid, created_at timestamp with time zone, overdue_days integer, fine_kobo bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
 |
| rls_auto_enable                     | CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| send_fee_reminders                  | CREATE OR REPLACE FUNCTION public.send_fee_reminders(p_min_days_between integer DEFAULT 7)
 RETURNS TABLE(reminders_sent integer, invoices_considered integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invoice record;
  v_recipient_id uuid;
  v_sent integer := 0;
  v_considered integer := 0;
  v_school_name text;
  v_had_recipient boolean;
begin
  if not (is_admin() or is_bursar()) then
    raise exception 'Only an admin or the bursar can send fee reminders.';
  end if;

  select name into v_school_name from school_settings where id = 1;

  for v_invoice in
    select
      i.id, i.student_id, i.total_amount_kobo, i.discount_kobo, i.amount_paid_kobo,
      i.term, i.academic_year,
      p.full_name as student_name,
      coalesce(fs.title, tfs.title, hfs.title, 'School fee') as fee_title
    from invoices i
    join student_profiles sp on sp.id = i.student_id
    join profiles p on p.id = sp.id
    left join fee_structures fs on fs.id = i.fee_structure_id
    left join transport_fee_structures tfs on tfs.id = i.transport_fee_structure_id
    left join hostel_fee_structures hfs on hfs.id = i.hostel_fee_structure_id
    where i.status in ('unpaid', 'partial')
      and i.voided_at is null
      and (i.last_reminded_at is null
           or i.last_reminded_at < now() - (p_min_days_between || ' days')::interval)
  loop
    v_considered := v_considered + 1;
    v_had_recipient := false;

    for v_recipient_id in
      select gl.parent_id from guardian_links gl where gl.student_id = v_invoice.student_id
    loop
      v_had_recipient := true;
      insert into messages (sender_id, recipient_id, content)
      values (
        auth.uid(),
        v_recipient_id,
        format(
          'Reminder: %s owes %s (Term %s, %s) for %s. Balance: ₦%s.',
          v_invoice.student_name,
          coalesce(v_school_name, 'the school'),
          v_invoice.term,
          v_invoice.academic_year,
          v_invoice.fee_title,
          to_char(
            (v_invoice.total_amount_kobo - v_invoice.discount_kobo - v_invoice.amount_paid_kobo) / 100.0,
            'FM999,999,999.00'
          )
        )
      );
    end loop;

    -- No parent linked: fall back to messaging the student directly so the
    -- reminder isn't silently dropped.
    if not v_had_recipient then
      insert into messages (sender_id, recipient_id, content)
      values (
        auth.uid(),
        v_invoice.student_id,
        format(
          'Reminder: you owe %s (Term %s, %s) for %s. Balance: ₦%s.',
          coalesce(v_school_name, 'the school'),
          v_invoice.term,
          v_invoice.academic_year,
          v_invoice.fee_title,
          to_char(
            (v_invoice.total_amount_kobo - v_invoice.discount_kobo - v_invoice.amount_paid_kobo) / 100.0,
            'FM999,999,999.00'
          )
        )
      );
    end if;

    update invoices set last_reminded_at = now() where id = v_invoice.id;
    v_sent := v_sent + 1;

    insert into audit_log (entity_type, entity_id, action, actor_id, metadata)
    values (
      'invoice', v_invoice.id, 'fee_reminder_sent', auth.uid(),
      jsonb_build_object('student_id', v_invoice.student_id, 'had_parent_recipient', v_had_recipient)
    );
  end loop;

  reminders_sent := v_sent;
  invoices_considered := v_considered;
  return next;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| start_quiz_attempt                  | CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
 RETURNS quiz_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| student_current_hostel              | CREATE OR REPLACE FUNCTION public.student_current_hostel(sid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select h.id
  from hostel_assignments ha
  join hostel_rooms hr on hr.id = ha.room_id
  join hostels h on h.id = hr.hostel_id
  where ha.student_id = sid
    and ha.unassigned_at is null
  limit 1;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| submit_quiz_attempt                 | CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_attempt_id uuid)
 RETURNS TABLE(score numeric, total_points numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| sync_student_class_from_enrollment  | CREATE OR REPLACE FUNCTION public.sync_student_class_from_enrollment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_year text;
  v_current_term integer;
BEGIN
  SELECT current_academic_year, current_term
    INTO v_current_year, v_current_term
    FROM school_settings
    WHERE id = 1;

  -- Only the enrollment for the *current* term should drive the cached
  -- class_id — don't let a backfilled/historical enrollment overwrite it.
  IF new.academic_year = v_current_year AND new.term = v_current_term THEN
    UPDATE student_profiles
       SET class_id = new.class_id
       WHERE id = new.student_id
         AND class_id IS DISTINCT FROM new.class_id;
  END IF;

  RETURN new;
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| topic_note_visible                  | CREATE OR REPLACE FUNCTION public.topic_note_visible(p_topic_id uuid, p_note_status note_status, p_author_id uuid, p_moderation_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_education_level education_level;
  v_level_number integer;
  v_academic_year text;
  v_term integer;
  v_week_number integer;
BEGIN
  IF is_admin() OR p_author_id = auth.uid() THEN
    RETURN true;
  END IF;

  -- A subject's HOD can see every note for that subject regardless of
  -- moderation state -- that's the point of the review workflow: they
  -- need to see pending (and rejected, to check a resubmission) notes
  -- to act on them, not just the ones already approved.
  IF is_hod_of_topic(p_topic_id) THEN
    RETURN true;
  END IF;

  IF p_note_status <> 'published' OR p_moderation_status <> 'approved' THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM teacher_profiles WHERE id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- topic_visible_to_student/parent take the 5-arg (level + week-of-term)
  -- signature added by the student/parent week-visibility migrations --
  -- this has to stay in sync with whatever that pair currently expects,
  -- not the older 2-arg (level-only) shape.
  SELECT education_level, level_number, academic_year, term, week_number
    INTO v_education_level, v_level_number, v_academic_year, v_term, v_week_number
    FROM curriculum_topics
    WHERE id = p_topic_id;

  RETURN topic_visible_to_student(
           v_education_level, v_level_number, v_academic_year, v_term, v_week_number
         )
      OR topic_visible_to_parent(
           v_education_level, v_level_number, v_academic_year, v_term, v_week_number
         );
END;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| topic_visible_to_parent             | CREATE OR REPLACE FUNCTION public.topic_visible_to_parent(t_education_level education_level, t_level_number integer, t_academic_year text, t_term integer, t_week_number integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_academic_year text;
  v_current_term integer;
  v_current_week integer;
  v_has_child_at_level boolean;
begin
  select exists (
    select 1
    from guardian_links gl
    join student_profiles sp on sp.id = gl.student_id
    join classes c on c.id = sp.class_id
    where gl.parent_id = auth.uid()
      and c.education_level = t_education_level
      and c.level_number = t_level_number
  ) into v_has_child_at_level;

  if not v_has_child_at_level then
    return false;
  end if;

  select current_academic_year, current_term
    into v_current_academic_year, v_current_term
    from school_settings
    where id = 1;

  -- Past term: fully visible.
  if t_academic_year < v_current_academic_year
     or (t_academic_year = v_current_academic_year and t_term < v_current_term) then
    return true;
  end if;

  -- Current term: visible up to (and including) the current scheme week.
  if t_academic_year = v_current_academic_year and t_term = v_current_term then
    v_current_week := current_scheme_week();
    return t_week_number <= coalesce(v_current_week, t_week_number);
  end if;

  -- Future term: not yet visible.
  return false;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| topic_visible_to_student            | CREATE OR REPLACE FUNCTION public.topic_visible_to_student(t_education_level education_level, t_level_number integer, t_academic_year text, t_term integer, t_week_number integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_academic_year text;
  v_current_term integer;
  v_current_week integer;
  v_is_own_level boolean;
begin
  select exists (
    select 1
    from student_profiles sp
    join classes c on c.id = sp.class_id
    where sp.id = auth.uid()
      and c.education_level = t_education_level
      and c.level_number = t_level_number
  ) into v_is_own_level;

  if not v_is_own_level then
    return false;
  end if;

  select current_academic_year, current_term
    into v_current_academic_year, v_current_term
    from school_settings
    where id = 1;

  -- Past term (earlier year, or same year earlier term): fully visible.
  if t_academic_year < v_current_academic_year
     or (t_academic_year = v_current_academic_year and t_term < v_current_term) then
    return true;
  end if;

  -- Current term: visible up to (and including) the current scheme week.
  if t_academic_year = v_current_academic_year and t_term = v_current_term then
    v_current_week := current_scheme_week();
    return t_week_number <= coalesce(v_current_week, t_week_number);
  end if;

  -- Anything else (a future term) is not yet visible.
  return false;
end;
$function$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| valid_level_number                  | CREATE OR REPLACE FUNCTION public.valid_level_number(level education_level, level_number integer)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case level
    when 'primary' then level_number between 1 and 6
    when 'jss' then level_number between 1 and 3
    when 'sss' then level_number between 1 and 3
  end;
$function$

| table_name               | trigger_name                            | action_timing | event_manipulation | action_statement                                       |
| ------------------------ | --------------------------------------- | ------------- | ------------------ | ------------------------------------------------------ |
| assets                   | trg_log_asset_change                    | AFTER         | INSERT             | EXECUTE FUNCTION log_asset_change()                    |
| assets                   | trg_log_asset_change                    | AFTER         | DELETE             | EXECUTE FUNCTION log_asset_change()                    |
| assets                   | trg_log_asset_change                    | AFTER         | UPDATE             | EXECUTE FUNCTION log_asset_change()                    |
| curriculum_topics        | trg_log_curriculum_topic_change         | AFTER         | INSERT             | EXECUTE FUNCTION log_curriculum_topic_change()         |
| curriculum_topics        | trg_log_curriculum_topic_change         | AFTER         | UPDATE             | EXECUTE FUNCTION log_curriculum_topic_change()         |
| curriculum_topics        | trg_log_curriculum_topic_change         | AFTER         | DELETE             | EXECUTE FUNCTION log_curriculum_topic_change()         |
| enrollments              | trg_log_enrollment_change               | AFTER         | UPDATE             | EXECUTE FUNCTION log_enrollment_change()               |
| enrollments              | trg_log_enrollment_change               | AFTER         | INSERT             | EXECUTE FUNCTION log_enrollment_change()               |
| enrollments              | trg_sync_student_class                  | AFTER         | UPDATE             | EXECUTE FUNCTION sync_student_class_from_enrollment()  |
| enrollments              | trg_sync_student_class                  | AFTER         | INSERT             | EXECUTE FUNCTION sync_student_class_from_enrollment()  |
| fee_structures           | trg_log_fee_structure_change            | AFTER         | INSERT             | EXECUTE FUNCTION log_fee_structure_change()            |
| fee_structures           | trg_log_fee_structure_change            | AFTER         | DELETE             | EXECUTE FUNCTION log_fee_structure_change()            |
| fee_structures           | trg_log_fee_structure_change            | AFTER         | UPDATE             | EXECUTE FUNCTION log_fee_structure_change()            |
| grades                   | trg_check_grade_score_bounds            | BEFORE        | UPDATE             | EXECUTE FUNCTION check_grade_score_bounds()            |
| grades                   | trg_check_grade_score_bounds            | BEFORE        | INSERT             | EXECUTE FUNCTION check_grade_score_bounds()            |
| homework_submissions     | trg_log_homework_submission_change      | AFTER         | INSERT             | EXECUTE FUNCTION log_homework_submission_change()      |
| homework_submissions     | trg_log_homework_submission_change      | AFTER         | UPDATE             | EXECUTE FUNCTION log_homework_submission_change()      |
| homework_submissions     | trg_protect_homework_submission_columns | BEFORE        | UPDATE             | EXECUTE FUNCTION protect_homework_submission_columns() |
| hostel_assignments       | trg_log_hostel_assignment_change        | AFTER         | UPDATE             | EXECUTE FUNCTION log_hostel_assignment_change()        |
| hostel_assignments       | trg_log_hostel_assignment_change        | AFTER         | INSERT             | EXECUTE FUNCTION log_hostel_assignment_change()        |
| hostel_fee_structures    | trg_log_hostel_fee_structure_change     | AFTER         | UPDATE             | EXECUTE FUNCTION log_hostel_fee_structure_change()     |
| hostel_fee_structures    | trg_log_hostel_fee_structure_change     | AFTER         | INSERT             | EXECUTE FUNCTION log_hostel_fee_structure_change()     |
| hostel_leave_logs        | trg_log_hostel_leave_change             | AFTER         | INSERT             | EXECUTE FUNCTION log_hostel_leave_change()             |
| hostel_leave_logs        | trg_log_hostel_leave_change             | AFTER         | UPDATE             | EXECUTE FUNCTION log_hostel_leave_change()             |
| hostel_visitor_logs      | trg_log_hostel_visitor_change           | AFTER         | UPDATE             | EXECUTE FUNCTION log_hostel_visitor_change()           |
| hostel_visitor_logs      | trg_log_hostel_visitor_change           | AFTER         | INSERT             | EXECUTE FUNCTION log_hostel_visitor_change()           |
| invoices                 | trg_log_invoice_change                  | AFTER         | DELETE             | EXECUTE FUNCTION log_invoice_change()                  |
| invoices                 | trg_log_invoice_change                  | AFTER         | INSERT             | EXECUTE FUNCTION log_invoice_change()                  |
| invoices                 | trg_log_invoice_change                  | AFTER         | UPDATE             | EXECUTE FUNCTION log_invoice_change()                  |
| profiles                 | protect_profile_privileged_columns      | BEFORE        | UPDATE             | EXECUTE FUNCTION protect_profile_privileged_columns()  |
| quizzes                  | trg_log_quiz_created                    | AFTER         | INSERT             | EXECUTE FUNCTION log_quiz_created()                    |
| route_vehicle_history    | trg_log_route_vehicle_change            | AFTER         | INSERT             | EXECUTE FUNCTION log_route_vehicle_change()            |
| route_vehicle_history    | trg_log_route_vehicle_change            | AFTER         | UPDATE             | EXECUTE FUNCTION log_route_vehicle_change()            |
| student_profiles         | protect_student_profile_class           | BEFORE        | UPDATE             | EXECUTE FUNCTION protect_student_profile_class()       |
| teacher_profiles         | protect_teacher_profile_staff_role      | BEFORE        | UPDATE             | EXECUTE FUNCTION protect_teacher_profile_staff_role()  |
| teacher_profiles         | protect_teacher_profile_subjects        | BEFORE        | UPDATE             | EXECUTE FUNCTION protect_teacher_profile_subjects()    |
| testimonials             | trg_log_testimonial_issued              | AFTER         | INSERT             | EXECUTE FUNCTION log_testimonial_issued()              |
| timetable_entries        | trg_check_timetable_conflict            | BEFORE        | UPDATE             | EXECUTE FUNCTION check_timetable_conflict()            |
| timetable_entries        | trg_check_timetable_conflict            | BEFORE        | INSERT             | EXECUTE FUNCTION check_timetable_conflict()            |
| transport_assignments    | trg_log_transport_assignment_change     | AFTER         | UPDATE             | EXECUTE FUNCTION log_transport_assignment_change()     |
| transport_assignments    | trg_log_transport_assignment_change     | AFTER         | INSERT             | EXECUTE FUNCTION log_transport_assignment_change()     |
| transport_fee_structures | trg_log_transport_fee_structure_change  | AFTER         | INSERT             | EXECUTE FUNCTION log_transport_fee_structure_change()  |
| transport_fee_structures | trg_log_transport_fee_structure_change  | AFTER         | UPDATE             | EXECUTE FUNCTION log_transport_fee_structure_change()  |
| transport_trip_status    | trg_log_transport_trip_status_change    | AFTER         | INSERT             | EXECUTE FUNCTION log_transport_trip_status_change()    |
| transport_trip_status    | trg_log_transport_trip_status_change    | AFTER         | UPDATE             | EXECUTE FUNCTION log_transport_trip_status_change()    |
| vehicles                 | trg_log_vehicle_driver_change           | AFTER         | UPDATE             | EXECUTE FUNCTION log_vehicle_driver_change()           |