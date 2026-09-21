-- HOD grade/lesson-plan approval was scoped to the HOD's own
-- subjects_taught (department-head model). Changing this to a
-- principal-level model: any active staff_role='hod' account can approve
-- grades and lesson plans for every subject, not just their own.
--
-- is_hod_of_subject() is the single root check -- is_hod_of_topic() and
-- topic_note_visible() already delegate to it, and both RLS policies
-- (grades_select_hod, grades_update_hod, notes_select_scoped,
-- resources_select_scoped, notes_update_hod) call it rather than
-- reimplementing the check, so replacing this one function's body
-- cascades correctly everywhere without touching policies or dependent
-- function signatures.

create or replace function is_hod_of_subject(sid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  -- sid is intentionally unused now -- kept so every existing call site
  -- (is_hod_of_subject(a.subject_id), RLS policies, is_hod_of_topic)
  -- keeps working unchanged. Any active HOD approves every subject.
  select exists (
    select 1
    from teacher_profiles tp
    join profiles p on p.id = tp.id
    where tp.id = auth.uid()
      and tp.staff_role = 'hod'
      and p.is_active = true
  );
$$;
