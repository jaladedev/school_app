-- Note search only matched whole (stemmed) words: "photo" found nothing
-- for a note about "photosynthesis". Plain searches now match by prefix,
-- so every word the person has typed so far is treated as the start of a
-- word ("photo synth" -> photo:* & synth:*).
--
-- Searches that use websearch operators -- "quoted phrases", -excluded
-- words, or the word "or" -- keep the original websearch_to_tsquery
-- behaviour, since prefix-expanding them would break the operators (an
-- excluded word would become a required one).
--
-- Same signature, return type and security-invoker semantics as
-- 2026_09_26d_search_topic_notes.sql, so RLS applies exactly as before.
create or replace function search_topic_notes(p_query text, p_limit integer default 20)
returns table(
  note_id uuid,
  topic_id uuid,
  topic_title text,
  subject_name text,
  snippet text,
  rank real
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with q as (
    select
      case
        when p_query ~ '"' or p_query ~ '(^|\s)-\S' or p_query ~* '\sor\s'
          then websearch_to_tsquery('english', p_query)
        else coalesce(
          (
            -- Tokens are reduced to letters/digits and quoted, so nothing the
            -- person types can inject tsquery syntax.
            select to_tsquery('english', string_agg(quote_literal(tok) || ':*', ' & '))
            from regexp_split_to_table(lower(p_query), '[^[:alnum:]]+') as tok
            where tok <> ''
          ),
          websearch_to_tsquery('english', p_query)
        )
      end as tsq
  )
  select
    n.id,
    n.topic_id,
    t.title,
    s.name,
    ts_headline(
      'english', n.content, q.tsq,
      -- Control-character delimiters, not HTML: see the original migration.
      'MaxFragments=1, MaxWords=25, MinWords=10, StartSel=' || chr(1) || ', StopSel=' || chr(2)
    ),
    ts_rank(n.content_search, q.tsq)
  from q, topic_notes n
  left join curriculum_topics t on t.id = n.topic_id
  left join subjects s on s.id = t.subject_id
  where n.content_search @@ q.tsq
  order by ts_rank(n.content_search, q.tsq) desc
  limit greatest(least(p_limit, 50), 1);
$$;

grant execute on function search_topic_notes(text, integer) to authenticated;
