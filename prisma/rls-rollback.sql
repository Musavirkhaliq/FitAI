-- Undo prisma/rls.sql: turn row-level security back off on every table (idempotent).
-- Use this if, after enabling RLS, the app can't read its own data (see DEPLOY.md, "If RLS breaks the app").
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
