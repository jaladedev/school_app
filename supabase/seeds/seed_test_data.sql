-- Seed data to fill remaining test-coverage gaps: parents, and every
-- teacher staff_role (bursar, librarian, house_parent, transport_officer,
-- driver, hod) had zero accounts before this; fees, hostels, transport,
-- library, homework, attendance, and announcements had zero rows.
-- All accounts share the password 'TestPass123!' and must_change_password
-- defaults to true, same as any admin-created account.

-- === 1. New accounts (auth.users -> profiles -> profile_contacts -> role tables) ===

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '40136aa1-b783-4e26-8162-eb9591f4da15', 'authenticated', 'authenticated', 'grace.alalade@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'dec5b0c9-e3af-429e-b1c0-ad6dbdfd3ee8', 'authenticated', 'authenticated', 'michael.forlan@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3', 'authenticated', 'authenticated', 'funmi.okafor@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '86e3b8d3-4d47-4d8a-980f-d8b0a88a556a', 'authenticated', 'authenticated', 'amaka.chukwu@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '074911eb-d582-4e16-a548-495d8401570d', 'authenticated', 'authenticated', 'ngozi.umeh@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '72ab69d0-d7c1-45c2-8959-a1d1e33db686', 'authenticated', 'authenticated', 'tunde.bakare@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'cbba340a-0add-4239-9674-3d1b88843870', 'authenticated', 'authenticated', 'emeka.nwosu@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '9fa43377-b0fc-4e52-b185-b690f421dceb', 'authenticated', 'authenticated', 'chidinma.eze@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'a7e88704-0e72-45be-86b7-59a5976ad7bf', 'authenticated', 'authenticated', 'amara.johnson@school-app.test', crypt('TestPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false);

insert into public.profiles (id, role, full_name) values
  ('40136aa1-b783-4e26-8162-eb9591f4da15', 'parent',  'Grace Alalade'),
  ('dec5b0c9-e3af-429e-b1c0-ad6dbdfd3ee8', 'parent',  'Michael Forlan'),
  ('b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3', 'teacher', 'Funmi Okafor'),
  ('86e3b8d3-4d47-4d8a-980f-d8b0a88a556a', 'teacher', 'Amaka Chukwu'),
  ('074911eb-d582-4e16-a548-495d8401570d', 'teacher', 'Ngozi Umeh'),
  ('72ab69d0-d7c1-45c2-8959-a1d1e33db686', 'teacher', 'Tunde Bakare'),
  ('cbba340a-0add-4239-9674-3d1b88843870', 'teacher', 'Emeka Nwosu'),
  ('9fa43377-b0fc-4e52-b185-b690f421dceb', 'teacher', 'Chidinma Eze'),
  ('a7e88704-0e72-45be-86b7-59a5976ad7bf', 'student', 'Amara Johnson');

insert into public.profile_contacts (id, email, phone) values
  ('40136aa1-b783-4e26-8162-eb9591f4da15', 'grace.alalade@school-app.test', '08031112221'),
  ('dec5b0c9-e3af-429e-b1c0-ad6dbdfd3ee8', 'michael.forlan@school-app.test', '08031112222'),
  ('b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3', 'funmi.okafor@school-app.test', '08031112223'),
  ('86e3b8d3-4d47-4d8a-980f-d8b0a88a556a', 'amaka.chukwu@school-app.test', '08031112224'),
  ('074911eb-d582-4e16-a548-495d8401570d', 'ngozi.umeh@school-app.test', '08031112225'),
  ('72ab69d0-d7c1-45c2-8959-a1d1e33db686', 'tunde.bakare@school-app.test', '08031112226'),
  ('cbba340a-0add-4239-9674-3d1b88843870', 'emeka.nwosu@school-app.test', '08031112227'),
  ('9fa43377-b0fc-4e52-b185-b690f421dceb', 'chidinma.eze@school-app.test', '08031112228'),
  ('a7e88704-0e72-45be-86b7-59a5976ad7bf', 'amara.johnson@school-app.test', '08031112229');

insert into public.teacher_profiles (id, staff_role, subjects_taught, hire_date) values
  ('b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3', 'bursar',            '{}', '2026-08-01'),
  ('86e3b8d3-4d47-4d8a-980f-d8b0a88a556a', 'librarian',         '{}', '2026-08-01'),
  ('074911eb-d582-4e16-a548-495d8401570d', 'house_parent',      '{}', '2026-08-01'),
  ('72ab69d0-d7c1-45c2-8959-a1d1e33db686', 'transport_officer', '{}', '2026-08-01'),
  ('cbba340a-0add-4239-9674-3d1b88843870', 'driver',            '{}', '2026-08-01'),
  ('9fa43377-b0fc-4e52-b185-b690f421dceb', 'hod', array['ea1cf1d9-8805-4355-90ee-a6ccc848886d']::uuid[], '2026-08-01');

insert into public.student_profiles (id, class_id, admission_no, guardian_name, guardian_phone, gender) values
  ('a7e88704-0e72-45be-86b7-59a5976ad7bf', '0e18ccc5-46eb-4edb-b477-6bb440e1be6c', 'ADM-2026-003', 'Grace Johnson', '08031112230', 'female');

insert into public.enrollments (student_id, class_id, academic_year, term)
values ('a7e88704-0e72-45be-86b7-59a5976ad7bf', '0e18ccc5-46eb-4edb-b477-6bb440e1be6c', '2026/2027', 1)
on conflict do nothing;

insert into public.guardian_links (parent_id, student_id, relationship, is_primary) values
  ('40136aa1-b783-4e26-8162-eb9591f4da15', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', 'mother', true),
  ('dec5b0c9-e3af-429e-b1c0-ad6dbdfd3ee8', '0cf77167-168b-498d-b103-680958daca6f', 'father', true);

-- === 2. Fees: structures, invoices (paid / partial / unpaid), payments ===

insert into public.fee_structures (id, education_level, level_number, term, academic_year, title, amount_kobo, due_date, created_by)
values
  ('11111111-1111-1111-1111-111111111101', 'primary', 4, 1, '2026/2027', 'Term 1 Tuition (Primary 4)', 15000000, '2026-09-30', 'b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3'),
  ('11111111-1111-1111-1111-111111111102', 'primary', 1, 1, '2026/2027', 'Term 1 Tuition (Primary 1)', 12000000, '2026-09-30', 'b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3');

insert into public.invoices (id, student_id, fee_structure_id, term, academic_year, total_amount_kobo, discount_kobo, amount_paid_kobo, status)
values
  ('22222222-2222-2222-2222-222222222201', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', '11111111-1111-1111-1111-111111111101', 1, '2026/2027', 15000000, 0, 15000000, 'paid'),
  ('22222222-2222-2222-2222-222222222202', '0cf77167-168b-498d-b103-680958daca6f', '11111111-1111-1111-1111-111111111101', 1, '2026/2027', 15000000, 0, 7000000, 'partial'),
  ('22222222-2222-2222-2222-222222222203', 'a7e88704-0e72-45be-86b7-59a5976ad7bf', '11111111-1111-1111-1111-111111111102', 1, '2026/2027', 12000000, 0, 0, 'unpaid');

insert into public.payments (invoice_id, student_id, amount_kobo, method, reference, verified_by)
values
  ('22222222-2222-2222-2222-222222222201', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', 15000000, 'card', 'SEED-REF-0001', null),
  ('22222222-2222-2222-2222-222222222202', '0cf77167-168b-498d-b103-680958daca6f', 7000000, 'cash', null, 'b57a7b07-4dd2-4d9c-8b7f-ed3ff96f36d3');

-- === 3. Hostel ===

insert into public.hostels (id, name, gender, house_parent_id, capacity)
values ('33333333-3333-3333-3333-333333333301', 'Unity Girls Hostel', 'female', '074911eb-d582-4e16-a548-495d8401570d', 40);

insert into public.hostel_rooms (id, hostel_id, room_number, capacity)
values ('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333301', 'A1', 4);

insert into public.hostel_assignments (student_id, room_id, academic_year, assigned_by)
values ('a7e88704-0e72-45be-86b7-59a5976ad7bf', '33333333-3333-3333-3333-333333333302', '2026/2027', '074911eb-d582-4e16-a548-495d8401570d');

insert into public.hostel_fee_structures (hostel_id, term, academic_year, title, amount_kobo, due_date, created_by)
values ('33333333-3333-3333-3333-333333333301', 1, '2026/2027', 'Term 1 Hostel Fee', 5000000, '2026-09-30', '074911eb-d582-4e16-a548-495d8401570d');

-- === 4. Transport ===

insert into public.vehicles (id, plate_number, model, capacity, driver_name, driver_phone, driver_profile_id)
values ('44444444-4444-4444-4444-444444444401', 'ABC-1234-XY', 'Toyota Hiace', 18, 'Emeka Nwosu', '08031112227', 'cbba340a-0add-4239-9674-3d1b88843870');

insert into public.transport_routes (id, name, description, vehicle_id)
values ('44444444-4444-4444-4444-444444444402', 'Agbowo - Bodija Route', 'Morning and afternoon run between Agbowo and Bodija.', '44444444-4444-4444-4444-444444444401');

insert into public.transport_stops (id, route_id, name, sequence_order, approx_time)
values
  ('44444444-4444-4444-4444-444444444403', '44444444-4444-4444-4444-444444444402', 'Agbowo Junction', 1, '07:00'),
  ('44444444-4444-4444-4444-444444444404', '44444444-4444-4444-4444-444444444402', 'Bodija Market', 2, '07:20');

insert into public.transport_assignments (student_id, route_id, stop_id, academic_year, assigned_by)
values ('0cf77167-168b-498d-b103-680958daca6f', '44444444-4444-4444-4444-444444444402', '44444444-4444-4444-4444-444444444403', '2026/2027', '72ab69d0-d7c1-45c2-8959-a1d1e33db686');

insert into public.transport_fee_structures (route_id, term, academic_year, title, amount_kobo, due_date, created_by)
values ('44444444-4444-4444-4444-444444444402', 1, '2026/2027', 'Term 1 Transport Fee', 3000000, '2026-09-30', '72ab69d0-d7c1-45c2-8959-a1d1e33db686');

insert into public.transport_trip_status (route_id, trip_date, direction, status, updated_by)
values ('44444444-4444-4444-4444-444444444402', current_date, 'morning', 'en_route', 'cbba340a-0add-4239-9674-3d1b88843870');

insert into public.transport_pickup_logs (student_id, route_id, trip_date, direction, picked_up_at, marked_by)
values ('0cf77167-168b-498d-b103-680958daca6f', '44444444-4444-4444-4444-444444444402', current_date, 'morning', now(), 'cbba340a-0add-4239-9674-3d1b88843870');

-- === 5. Library ===

insert into public.library_books (id, title, author, isbn, category, total_copies, available_copies, created_by)
values
  ('55555555-5555-5555-5555-555555555501', 'Things Fall Apart', 'Chinua Achebe', '9780435905255', 'Literature', 5, 4, '86e3b8d3-4d47-4d8a-980f-d8b0a88a556a'),
  ('55555555-5555-5555-5555-555555555502', 'Basic Mathematics for Primary Schools', 'NERDC', null, 'Textbook', 10, 10, '86e3b8d3-4d47-4d8a-980f-d8b0a88a556a');

insert into public.library_loans (book_id, student_id, due_at, issued_by)
values ('55555555-5555-5555-5555-555555555501', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', current_date + interval '14 days', '86e3b8d3-4d47-4d8a-980f-d8b0a88a556a');

-- === 6. Announcements ===

insert into public.announcements (author_id, title, content, audience, class_id) values
  ('5f6f9fb3-6798-4269-a23f-9d610a95bfff', 'Welcome to the 2026/2027 Session', 'We are excited to welcome all students and staff back for the new academic session. Please check your dashboards for updated timetables.', 'all', null),
  ('6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a', 'Primary 4 Excursion Notice', 'Primary 4 will be going on an excursion to the science museum next month. Permission slips will be sent home shortly.', 'class', 'c0d44e87-cd49-467c-96f8-9b538c9a9928');

-- === 7. Homework submissions (against the existing lesson) ===

insert into public.homework_submissions (lesson_id, student_id, file_url, file_name, status, teacher_remark, reviewed_by, reviewed_at)
values
  ('f6908e3a-8f3b-4b18-b16d-008907cc6db8', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', 'https://example.test/seed/homework-lucy.pdf', 'homework-lucy.pdf', 'reviewed', 'Good work, well presented.', '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a', now()),
  ('f6908e3a-8f3b-4b18-b16d-008907cc6db8', '0cf77167-168b-498d-b103-680958daca6f', 'https://example.test/seed/homework-diego.pdf', 'homework-diego.pdf', 'submitted', null, null, null);

-- === 8. Attendance (Primary 4, last three school days) ===

insert into public.attendance (class_id, student_id, date, status, marked_by) values
  ('c0d44e87-cd49-467c-96f8-9b538c9a9928', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', current_date - 2, 'present', '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a'),
  ('c0d44e87-cd49-467c-96f8-9b538c9a9928', '0cf77167-168b-498d-b103-680958daca6f', current_date - 2, 'late',    '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a'),
  ('c0d44e87-cd49-467c-96f8-9b538c9a9928', 'c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', current_date - 1, 'present', '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a'),
  ('c0d44e87-cd49-467c-96f8-9b538c9a9928', '0cf77167-168b-498d-b103-680958daca6f', current_date - 1, 'absent',  '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a');

-- === 9. Student notes + report card remark ===

insert into public.student_notes (student_id, author_id, note_type, content, visible_to_student)
values ('c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', '6f2c3aa8-13ef-4c2d-a88b-1f5c1a7d586a', 'commendation', 'Consistently helpful to classmates and attentive in class.', true);

insert into public.report_card_remarks (student_id, term, academic_year, class_teacher_remark, moderation_status, approved_by, approved_at)
values ('c5405ad6-5723-4e5f-98d7-63d9aab5ccdb', 1, '2026/2027', 'Lucy has had an excellent start to the term.', 'approved', '5f6f9fb3-6798-4269-a23f-9d610a95bfff', now());
