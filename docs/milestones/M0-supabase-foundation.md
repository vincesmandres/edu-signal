# M0 Supabase Foundation

## Current architecture

Edu Signal is a Next.js App Router application running through Vinext. Server
routes call Drizzle directly through `db/index.ts`; the adapter is Cloudflare
D1 and the schema uses Drizzle SQLite tables. The current domain already
contains educators, sessions, classrooms, learning modules, assessments,
students, enrollments, rubrics, rubric criteria, evidences, evaluations,
evaluation scores, credentials, and audit events.

Authentication is currently a first-party password/session flow backed by
`educators` and `sessions`, with an additional ChatGPT identity-header flow.
Most write/read APIs use this compatibility layer. File upload currently uses
a Cloudflare R2 binding (`EVIDENCE_BUCKET`), while the worker and AI route use
Cloudflare bindings.

## Migration strategy

### Preserve

- Existing educational table names, domain contracts, and string UUID values.
- Existing password/session and ChatGPT authentication during M0.
- Server-side Drizzle access patterns and HTTP API contracts.
- Cloudflare worker configuration until the Vercel runtime path is verified.

### Change

- Use Drizzle PostgreSQL tables and a server-only `DATABASE_URL` connection.
- Keep the historical SQLite migrations under `drizzle/` untouched and generate
  the new PostgreSQL history under `drizzle-postgres/` because their metadata
  cannot be parsed as PostgreSQL snapshots.
- Use native PostgreSQL `timestamptz` columns while retaining string mode in
  Drizzle so existing API contracts remain stable.
- Add `profiles` as the future `auth.users` projection and base RLS policies.
- Add Supabase browser/server client factories without using the service role
  for normal user operations.
- Make migrations and development seed SQL reproducible under `supabase/`.
- Keep the generated Drizzle schema migration in `drizzle-postgres/`; apply
  `supabase/migrations/` with the Supabase CLI so RLS and Storage are tracked.

Storage uses a private Supabase bucket named `evidence`. Future objects will
use `evidence/{classroomId}/{studentId}/{evidenceId}`; PostgreSQL stores the
metadata and Storage stores the file. Upload/download authorization is deferred
until identity and membership policies are available.

### Defer

- Full Supabase Auth migration, profile backfill, and role-based interfaces to
  M1.
- Complete classroom/evidence RLS matrix, signed upload flows, and evidence
  uploads to the private Supabase Storage bucket.
- Removal of Cloudflare AI/R2/worker bindings after the Vercel deployment path
  is established.

## Risks

- PostgreSQL is stricter than SQLite about types, constraints, and transaction
  behavior; generated SQL must be applied to a fresh Supabase database first.
- Existing IDs are kept as text UUIDs to avoid a destructive migration. The
  future `profiles.id` is a native UUID because it maps to `auth.users.id`.
- Existing sessions remain separate from Supabase Auth until M1; they must not
  be treated as Supabase access tokens.
- Existing Cloudflare-specific imports cannot run in a plain Vercel build and
  remain isolated debt for the deployment cleanup milestone.
- Storage metadata and database writes are not yet one atomic transaction.

## Definition of Done

- [x] Repository audited before architecture changes.
- [x] M0 architecture and migration strategy documented.
- [x] `.env.example` contains no secrets.
- [x] PostgreSQL/Supabase is the target persistence path and Drizzle dialect.
- [x] Existing domain entities are preserved.
- [x] PostgreSQL migrations can be generated and applied reproducibly from `drizzle-postgres/`.
- [x] `profiles` is prepared for `auth.users`.
- [x] Base RLS policies exist for profiles.
- [x] Private evidence Storage strategy is documented/configured.
- [x] Development seed mechanism exists.
- [x] `npm run db:seed` creates demo teacher, student, classroom, enrollment,
  and module records without real personal data.
- [x] Database health check exists without sensitive output.
- [x] Client/server Supabase boundaries are explicit.
- [x] `profiles.id` is constrained to `auth.users.id` in the Supabase migration.
- [ ] Full Supabase Auth migration (M1 scope).
- [ ] Complete Vercel/Cloudflare provider cleanup (follow-up scope).
- [ ] `npm run build`, `npm run lint`, and relevant tests pass.
