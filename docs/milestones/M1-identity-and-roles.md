# M1 Identity and Roles

## Problem

The historical application authenticated educators with a local password hash
and session table. That allowed an academic student record to exist without an
authenticated platform identity and made role authorization depend on legacy
records.

## Architecture

Supabase Auth is the only active authentication system. A Supabase Auth user
is mapped one-to-one to `public.profiles`; the profile stores the display name
and server-controlled role. Server Components, route handlers, and the
middleware use the Supabase SSR client with cookies. Authorization is checked
again server-side through `lib/auth.ts` and is never derived from client state.

## Auth flow

`POST /api/auth/signup` calls `supabase.auth.signUp` and accepts only display
name, email, and password. It never accepts a role as authority. The database
trigger `on_auth_user_created` creates a `student` profile automatically.

`POST /api/auth/login` calls `signInWithPassword`, reads the authenticated user,
loads its profile, records an audit event, and returns a role-based destination.
`POST /api/auth/logout` calls `supabase.auth.signOut` and records the event.
`/auth/signup` and `/login` provide the corresponding UI entry points.

## Role model

Allowed roles are `teacher`, `student`, `coordinator`, and `admin`, enforced by
the PostgreSQL check constraint. Public signup always creates `student`.
Development teacher accounts are created only by `npm run auth:seed`, which
requires the server-only service role key and passwords supplied through the
environment. No password is stored or documented in the repository.
After that command prints the Auth UUIDs, run `npm run db:seed` with
`SEED_TEACHER_ID` and `SEED_STUDENT_PROFILE_ID` set to create the educational
demo records.

## RLS

Profiles allow a user to select and update only their own row. A database
trigger rejects self-service role, identity, and timestamp changes. SQL column
privileges grant authenticated users update access only to `display_name`.
Profile inserts are performed by the `security definer` Auth trigger, not by an
anonymous client. Educational tables remain RLS-enabled and deny-by-default
until membership policies are designed for M2.

## Authorization strategy

`lib/auth.ts` obtains the Auth user through the SSR client and then reads the
server-side profile through Drizzle. `requireUser` and `requireRole` protect
Server Components; `getApiProfile` protects Route Handlers before database
access. The client never supplies or decides a role.

## Route protection

Teacher routes are `/`, `/classrooms`, `/students`, `/rubrics`, and `/evidence`.
`/student` is student-only. `/coordinator` and `/admin` are protected shells.
Anonymous users are redirected to `/login`; incompatible roles are redirected
to their safe workspace or `/forbidden` before rendering protected data.

## Migration from legacy auth

The custom password hashing, session cookie, and auth route implementation was
removed from the active application. The historical `educators` and `sessions`
tables remain in PostgreSQL only as legacy data until a controlled backfill and
retention decision is made. Domain teacher ownership now uses `profiles.id`;
`students.profile_id` provides the optional bridge from an existing academic
record to an authenticated student profile.

The application no longer imports the legacy auth module, reads
`educators.password_hash`, or creates `sessions`. The legacy tables remain only
for historical data and controlled backfill. Teacher-owned domain foreign keys
now reference `profiles.id`; existing rows are tolerated with `NOT VALID` until
the corresponding Auth accounts are backfilled.

## Known limitations

- A real Supabase project must apply both Drizzle migrations and
  `supabase/migrations/` before the flow can run.
- Email confirmation behavior depends on the Supabase project setting.
- Existing legacy educator records require an explicit Auth account backfill;
  M1 does not invent or migrate passwords.
- The teacher foreign keys are initially `NOT VALID` so legacy rows do not make
  the migration fail; new writes must reference a profile until backfill is
  complete.
- Coordinator/admin assignment is an administrative operation, not public
  signup.
- The current `students` table remains an academic record and is not created
  automatically for every student profile.

## M2 handoff

M2 can build the student workspace on `/student`. Before exposing educational
data through Supabase clients, add classroom membership RLS for `classrooms`,
`students`, `enrollments`, modules, evidence, and evaluations.

## Definition of Done

- [x] Supabase Auth is the only active login system.
- [x] Auth users receive profiles through a database trigger.
- [x] Public signup defaults to `student` and ignores privileged role payloads.
- [x] Teacher and student route/API guards validate roles server-side.
- [x] Profile role escalation is blocked by RLS, column privileges, and trigger.
- [x] Legacy password/session code is no longer active.
- [x] Demo-user creation is documented through the server-only seed script.
- [x] Build, lint, and identity tests pass locally.
- [ ] Live Supabase signup/RLS smoke test requires project credentials.
