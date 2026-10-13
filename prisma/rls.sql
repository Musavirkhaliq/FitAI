-- Row-level security hardening (idempotent). Run once per database:  npm run db:rls
--
-- Why: on Supabase every table in `public` is also exposed through the project's REST API to the `anon` and
-- `authenticated` roles. FitTrack never uses that API for data (all access goes through the app server using
-- Prisma), so we turn RLS on for every table and add NO policies: those roles can then read and write nothing.
--
-- The app is unaffected: Prisma connects as the table owner (the `postgres` role on Supabase), and owners bypass RLS
-- unless FORCE ROW LEVEL SECURITY is set, which we deliberately do not do.
--
-- Safe on plain Postgres too (the role-related statements are skipped when the Supabase roles don't exist).

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  -- Belt and braces: also remove table privileges from the public API roles when they exist.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;
