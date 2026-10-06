-- Gives Primary 1 (class teacher: Gabriel Batistuta) a timetable so it shows
-- under "My classes" on the teacher dashboard, which is built from
-- timetable_entries rather than classes.class_teacher_id.
--
-- Looks everything up by name/code, so it is safe to run on any copy of the
-- DB and safe to re-run (skips rows that already exist). Slots avoid
-- Gabriel's existing Primary 4 periods (Mon P1, Tue P1, Wed P2).

insert into public.timetable_entries
  (class_id, subject_id, teacher_id, weekday, period_number, start_time, end_time, academic_year, term)
select c.id, s.id, c.class_teacher_id, v.weekday, v.period_number, v.start_time::time, v.end_time::time, c.academic_year, 1
from public.classes c
join (values
  (1, 2, '08:45', '09:25', 'MTH-P13'),
  (2, 2, '08:45', '09:25', 'ENG-P13'),
  (3, 1, '08:00', '08:40', 'MTH-P13')
) as v(weekday, period_number, start_time, end_time, subject_code) on true
join public.subjects s on s.code = v.subject_code
where c.name = 'Primary 1'
  and c.arm = 'A'
  and c.class_teacher_id is not null
  and not exists (
    select 1 from public.timetable_entries t
    where t.class_id = c.id
      and t.weekday = v.weekday
      and t.period_number = v.period_number
  );
