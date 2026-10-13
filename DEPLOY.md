# Deploying updates (production runbook)

Read this before pulling a new batch of changes onto a running site. Everything here was tested against a fresh database and a
production-like database that already held data; the steps are ordered so a mistake fails safely.

## 0. Before you pull

1. **Back up the database** (Supabase → Database → Backups, or `pg_dump`). The migrations below are additive, but a backup costs nothing.
2. **Rotate any secret that has ever been pasted into a chat, ticket or email**: the database password, `AUTH_SECRET`, and any API key.
   A leaked `AUTH_SECRET` lets someone forge a login session for any user; changing it signs everyone out once, which is fine.
   Generate a new one with `npx auth secret` and set it in the production environment.
3. Note the current commit so you can roll back: `git rev-parse HEAD`.

## 1. Pull, install, build

```bash
git pull
npm ci
npm run build        # runs `prisma generate` first
```

No new environment variable is **required**. Optional ones (all documented in `.env.example`): `LLM_EXTRACT_MODEL`,
`ASSEMBLYAI_API_KEY`, `ELEVENLABS_*`, and `STT_PROVIDER=local`. Production secrets live in the server's environment, not in git.

## 2. Database migration (one time, before restarting the app)

The app now uses committed Prisma migrations (`prisma/migrations/`). Your database was created earlier with `db push`, so it already
contains the schema of migration `20261013000000_init`. Tell Prisma that, then apply what's new (a single additive table,
`progress_photos`). Run with the **production** `DATABASE_URL` and `DIRECT_URL` set in the environment:

```bash
npx prisma migrate deploy        # on an existing DB this REFUSES with P3005 and changes nothing: expected
npx prisma migrate resolve --applied 20261013000000_init
npx prisma migrate deploy        # applies 20261014000000_progress_photos
```

Verified on a database that already held a user: the user and all existing rows are untouched.
A brand-new database just needs `npx prisma migrate deploy`.

> Use the **direct** (or session-pooler, port 5432) connection for `DIRECT_URL`. The transaction pooler (port 6543) can't run migrations.

## 3. Restart and smoke-test

Restart the process, then check, in a private window:

- [ ] Sign in with an existing account; Today loads.
- [ ] `/nutrition` shows the day, and "Vitamins & minerals" opens.
- [ ] `/progress` shows "Progress photos"; upload a small photo and delete it.
- [ ] Type a message in the coach box and get a reply (checks your LLM key and the database).
- [ ] Voice: with a transcription key configured the mic records and transcribes; with none, Chrome/Edge uses browser recognition.

## 4. Optional: row-level security (Supabase only)

Supabase also exposes every `public` table through its REST API. FitTrack never uses that API for data, so enabling RLS with no
policies shuts that door entirely. The app is unaffected **as long as it connects as the role that owns the tables** (on Supabase,
`postgres`), because owners bypass RLS.

Check first, with the same connection string the app uses:

```sql
select current_user;                                           -- the role the app connects as
select distinct tableowner from pg_tables where schemaname = 'public';   -- must show the same role
```

If both show the same role, run `npm run db:rls` (or paste `prisma/rls.sql` into the Supabase SQL editor), then repeat the smoke test.

**If RLS breaks the app** (pages empty, "permission denied", everything 500s): run `prisma/rls-rollback.sql` (`npm run db:rls:rollback`).
It is instant and safe to run any time.

## 5. What users will notice

- Sign-in with Google on an account that was registered by password but never email-verified now **discards that password**
  (closes a pre-registration hijack). The person who proves ownership through Google keeps access.
- New: vitamins & minerals (estimates), veg/fruit "−" button, streaks on the Dashboard, progress photos, voice dictation in onboarding,
  and browser speech recognition when no transcription key is configured.

## 6. Rolling back

- **Code:** `git checkout <previous commit>`, rebuild, restart. The old code ignores the new `progress_photos` table, so the database
  needs no rollback.
- **RLS:** `npm run db:rls:rollback`.
- Don't delete the `_prisma_migrations` table; it is how Prisma knows what has been applied.
