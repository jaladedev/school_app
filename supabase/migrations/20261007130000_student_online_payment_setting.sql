-- Lets an admin decide whether students may pay their own fees online.
--
-- Parents/guardians can always pay. Students can always *see* their
-- invoices; this only controls the "Pay with card" button on the student
-- fees page (and the server-side check behind it). Defaults to true so
-- deploying this doesn't change anything for schools already relying on
-- student payments -- an admin opts out in School settings.
alter table school_settings
  add column if not exists student_online_payment_enabled boolean not null default true;
