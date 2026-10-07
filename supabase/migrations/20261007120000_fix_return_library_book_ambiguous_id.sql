-- Fix: return_library_book() fails with
--   42702 column reference "id" is ambiguous
--   "It could refer to either a PL/pgSQL variable or a table column."
--
-- Why: the function is declared `returns table(id uuid, book_id uuid,
-- student_id uuid, ..., due_at date, returned_at timestamptz, ...)`. In
-- PL/pgSQL every RETURNS TABLE column is also an OUT variable in scope
-- for the whole body, so any *unqualified* reference to one of those
-- names inside a query (`where id = p_loan_id`, `where id = 1`, ...) is
-- ambiguous between the variable and the table column. Every return was
-- failing on the very first SELECT, so no loan could be marked returned
-- and no overdue fine was ever invoiced.
--
-- The signature and return shape are unchanged (callers in
-- lib/actions/library.ts keep working as-is); only the body changes so
-- every column reference in a query is qualified with a table alias.

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

  select ll.* into v_loan from library_loans ll where ll.id = p_loan_id for update;

  if v_loan.id is null then
    raise exception 'Loan not found.';
  end if;

  if v_loan.returned_at is not null then
    raise exception 'This loan was already marked returned.';
  end if;

  update library_loans ll
    set returned_at = now(), returned_to = auth.uid()
    where ll.id = p_loan_id
    returning ll.* into v_loan;

  update library_books lb
    set available_copies = lb.available_copies + 1
    where lb.id = v_loan.book_id;

  v_overdue_days := greatest(0, (v_loan.returned_at::date - v_loan.due_at));

  if v_overdue_days > 0 then
    select ss.current_academic_year, ss.current_term, ss.library_fine_kobo_per_day
      into v_academic_year, v_term, v_fine_rate
      from school_settings ss where ss.id = 1;

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
