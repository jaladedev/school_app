-- HOD grade moderation was approve-only. This adds a "rejected" state so an
-- HOD can send grades back to the teacher with a reason.
--
-- Rejected grades stay hidden from students/parents (their policies only
-- ever show 'approved'). The assigned teacher may edit a rejected grade, and
-- saving it puts the grade back to 'pending' for another review.

alter table public.grades drop constraint if exists grades_moderation_status_check;
alter table public.grades
  add constraint grades_moderation_status_check
  check (moderation_status = any (array['pending'::text, 'approved'::text, 'rejected'::text]));

alter table public.grades
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

-- Teacher UPDATE: the existing row may be pending OR rejected; whatever they
-- save must come back as pending (so a rejected grade can't be edited and
-- left in a state that looks reviewed).
drop policy if exists grades_update_assigned_teacher on public.grades;
create policy grades_update_assigned_teacher on public.grades
  for update
  using (
    is_admin() or (
      moderation_status = any (array['pending'::text, 'rejected'::text])
      and exists (
        select 1
        from assessments a
        join timetable_entries te on te.class_id = a.class_id and te.subject_id = a.subject_id
        where a.id = grades.assessment_id and te.teacher_id = auth.uid()
      )
    )
  )
  with check (
    is_admin() or (
      moderation_status = 'pending'
      and exists (
        select 1
        from assessments a
        join timetable_entries te on te.class_id = a.class_id and te.subject_id = a.subject_id
        where a.id = grades.assessment_id and te.teacher_id = auth.uid()
      )
    )
  );
