-- Two things needed to let teachers edit a quiz's questions:
--
-- 1) quiz_questions.question_type was still limited to mcq/true_false. The
--    fill_blank / matching / essay types (2026_08_03b_quiz_question_types.sql)
--    added the columns they need but never widened this check, so creating
--    a quiz with any of those types failed with a check violation.
--
-- 2) replace_quiz_questions(): swaps a quiz's whole question set in one
--    transaction (same JSON shape as create_quiz_with_questions) and keeps
--    the linked assessment's max_score in step with the new total points.
--    Only allowed while the quiz is unpublished AND has no attempts --
--    quiz_answers point at question/option ids, so replacing questions under
--    recorded attempts would orphan or rewrite students' answers and scores.

alter table public.quiz_questions drop constraint if exists quiz_questions_question_type_check;
alter table public.quiz_questions
  add constraint quiz_questions_question_type_check
  check (question_type = any (array['mcq'::text, 'true_false'::text, 'fill_blank'::text, 'matching'::text, 'essay'::text]));

create or replace function public.replace_quiz_questions(p_quiz_id uuid, p_questions jsonb)
returns void
language plpgsql
as $$
declare
  v_quiz quizzes%rowtype;
  v_total numeric;
  v_question jsonb;
  v_option jsonb;
  v_question_id uuid;
  v_q_index int := 0;
  v_o_index int;
begin
  -- Lock the quiz row so the checks below can't race a concurrent publish.
  select * into v_quiz from quizzes where id = p_quiz_id for update;
  if not found then
    raise exception 'Quiz not found.';
  end if;
  if v_quiz.is_published then
    raise exception 'Unpublish this quiz before editing its questions.';
  end if;
  if exists (select 1 from quiz_attempts where quiz_id = p_quiz_id) then
    raise exception 'This quiz already has student attempts, so its questions can''t be changed.';
  end if;
  if jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one question.';
  end if;

  select coalesce(sum((q->>'points')::numeric), 0) into v_total
  from jsonb_array_elements(p_questions) as q;

  delete from quiz_options where question_id in (select id from quiz_questions where quiz_id = p_quiz_id);
  delete from quiz_questions where quiz_id = p_quiz_id;

  for v_question in select * from jsonb_array_elements(p_questions)
  loop
    v_q_index := v_q_index + 1;

    insert into quiz_questions (quiz_id, question_text, question_type, points, sequence_order)
    values (
      p_quiz_id,
      v_question->>'question_text',
      v_question->>'question_type',
      (v_question->>'points')::numeric,
      v_q_index
    )
    returning id into v_question_id;

    v_o_index := 0;
    for v_option in select * from jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
    loop
      v_o_index := v_o_index + 1;
      insert into quiz_options (question_id, option_text, match_prompt, is_correct, sequence_order)
      values (
        v_question_id,
        v_option->>'text',
        v_option->>'match_prompt',
        (v_option->>'is_correct')::boolean,
        v_o_index
      );
    end loop;
  end loop;

  update assessments set max_score = v_total where id = v_quiz.assessment_id;
end;
$$;

-- The server action authorizes the caller (admin / quiz owner) and then
-- calls this with the service-role key; nobody else should call it directly.
revoke execute on function public.replace_quiz_questions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_quiz_questions(uuid, jsonb) to service_role;
