-- Security/performance hardening from Supabase advisor findings (2026-09-21).
--
-- 1. Explicit search_path on functions that were missing it. None of these
--    are SECURITY DEFINER, so the risk is low (they run with the caller's
--    own privileges) -- except custom_access_token_hook, which Supabase
--    Auth invokes internally with elevated context regardless of the
--    SECURITY DEFINER keyword, so it's the one that actually matters here.
--    Fixed as defense-in-depth for all nine regardless, since it's free
--    and matches the pattern already used by every other function in the
--    schema.
--
-- 2. Two pairs of duplicate unique indexes (guardian_links,
--    report_card_remarks) -- pure redundancy, safe to drop one of each.

alter function public.custom_access_token_hook(jsonb) set search_path = public;
alter function public.valid_level_number(education_level, integer) set search_path = public;
alter function public.check_timetable_conflict() set search_path = public;
alter function public.current_scheme_week() set search_path = public;
alter function public.check_grade_score_bounds() set search_path = public;
alter function public.swap_transport_stop_order(uuid, uuid) set search_path = public;
alter function public.replace_invoice_installments(uuid, uuid, jsonb) set search_path = public;
alter function public.create_quiz_with_questions(
  uuid, uuid, text, integer, text, uuid, integer, timestamptz, timestamptz, jsonb
) set search_path = public;
alter function public.create_quiz_with_questions(
  uuid, uuid, text, integer, text, uuid, integer, timestamptz, timestamptz, jsonb, boolean
) set search_path = public;

alter table public.guardian_links
  drop constraint if exists guardian_links_parent_id_student_id_key;
alter table public.report_card_remarks
  drop constraint if exists report_card_remarks_student_id_term_academic_year_key;
