# Edu Signal M4.5 System Audit

## Executive Summary

The audit was performed from branch `chore/full-system-audit` at commit
`2cfa1e4`. The working tree was clean at the start and no merge, rebase, or
cherry-pick was in progress. Local installation, type checking, lint, build,
and regression tests pass. The system is **not stable for M5** because the
repository contains only M0/M0.5/M1 implementation; M1.5, M2, M3, and M4 are
not verified or implemented in the current HEAD.

## System Status

| Area | Status | Evidence |
| --- | --- | --- |
| Git | VERIFIED | Clean `main` at `2cfa1e4`; audit branch created |
| Runtime | VERIFIED | Native Next.js and `.next/` output |
| PostgreSQL | CODE PATH VERIFIED | Drizzle Node PostgreSQL adapter; no live DB configured |
| Auth | CODE PATH VERIFIED | Supabase Auth routes and SSR client exist |
| RLS | NOT VERIFIED | SQL exists; no linked Supabase project |
| Student Workspace | NOT IMPLEMENTED | `/student` remains the M1 shell |
| Modules | NOT IMPLEMENTED | No M3 implementation |
| Activities | NOT IMPLEMENTED | No M4 implementation |
| Responses/Progress | NOT IMPLEMENTED | No M4 implementation |
| Deployment | NOT VERIFIED | No Vercel deployment tooling/access in this environment |

## Architecture

The intended runtime is Next.js → Vercel → Supabase. Active application code
uses Drizzle PostgreSQL and Supabase SSR/Auth clients. Historical SQLite
migrations remain under `drizzle/`; PostgreSQL migrations are under
`drizzle-postgres/`; Supabase-specific SQL is under `supabase/migrations/`.

## Git State

- Branch at start: `main`.
- HEAD at start: `2cfa1e4 fix: stabilize Vercel and Supabase runtime`.
- Working tree: clean.
- Audit branch: `chore/full-system-audit`.
- Conflict markers: none found in source/config/migration files.
- No unfinished merge, rebase, or cherry-pick detected.

## Database State

The checked-in schema contains `profiles`, legacy `educators`/`sessions`,
`students`, `enrollments`, `classrooms`, and `learning_modules`. It does not
contain `learning_activities`, `activity_responses`, or
`student_activity_progress`. `students.profile_id` is unique and nullable.
`enrollments` has indexes on both foreign keys but no unique
`(student_id, classroom_id)` constraint.

No live database was available, so orphan counts, duplicate counts, remote
schema drift, and invalid statuses could not be measured.

## Migration State

`npm run db:generate` is available for Drizzle PostgreSQL migrations. Supabase
CLI commands were attempted:

```text
npx supabase migration list       BLOCKED: project not linked
npx supabase db push --dry-run    BLOCKED: project not linked
```

No migration was pushed or reset.

## Auth

Supabase Auth is the active code path. The Auth trigger creates profiles with a
safe `student` role, and server helpers resolve profiles from the authenticated
user. Legacy table columns `educators.password_hash` and `sessions.token_hash`
remain historical schema only and are not used by active routes.

Live signup, login, profile creation, and session tests were not possible
without a linked Supabase project and demo credentials.

## RLS

Profile SQL contains own-profile policies, role protection, and column grants.
Educational tables are RLS-enabled/deny-by-default, but student classroom and
activity policies do not exist because M2/M4 are not implemented.

## Teacher Isolation

Teacher route handlers perform server-side profile/role checks and scope current
teacher-owned queries. Live cross-teacher ownership tests were not verified.

## Student Isolation

Not implemented. There is no student query layer, enrollment-derived context,
classroom route, module route, or live Student A/Student B isolation test.

## Modules

The existing teacher classroom flow can create a learning module in draft. No
M3 publish/edit/student visibility workflow exists in this HEAD.

## Activities

Not implemented. No activity lifecycle, type validation, ordering, or activity
RLS exists.

## Responses

Not implemented. No response table or response ownership policies exist.

## Progress

Not implemented. No progress table or derived progress calculation exists.

## Security Findings

| ID | Severity | Area | Problem | Reproduced | Fixed | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 | P1 | Live Auth | Supabase project is not linked; live Auth cannot be verified | Yes | No | No |
| RLS-001 | P1 | RLS | Profile and educational RLS cannot be tested against a real database | Yes | No | No |
| DATA-001 | P2 | Integrity | Enrollment uniqueness is not enforced in checked-in Drizzle schema | Yes | No | No |
| M2-001 | P1 | Product gate | Student Workspace is not implemented | Yes | No | No |
| M3-001 | P1 | Product gate | Learning Modules publication/student flow is not implemented | Yes | No | No |
| M4-001 | P1 | Product gate | Activity Engine is not implemented | Yes | No | No |
| DEPLOY-001 | P1 | Deployment | Vercel deployment status is unavailable | Yes | No | No |
| SEC-001 | P2 | Dependency | `npm audit` reports 6 high, 4 moderate, and 1 low vulnerability | Yes | No | No |

No P0 secret exposure or active Cloudflare runtime import was found.

## Performance Findings

No M2/M4 query layer exists to audit for N+1. Existing indexes cover several
teacher/classroom joins. Student-specific indexes and activity indexes cannot
be assessed because those tables do not exist.

## Accessibility Findings

The current teacher UI uses semantic form labels and links in existing flows.
Student and activity accessibility cannot be audited because those surfaces do
not exist.

## Tests

Results from this audit:

```text
npm ci             PASS (Node 24 warning; project requires Node 22.x)
npm ls             PASS
npx tsc --noEmit   PASS
npm run lint       PASS
npm test           PASS
npm run build      PASS
npm audit          11 vulnerabilities: 6 high, 4 moderate, 1 low
```

The build emitted a non-blocking `metadataBase` warning. The current tests are
local/static regression tests; they are not live Auth/RLS/E2E tests.

## Deployment

Not verified. Vercel project access and deployment logs were unavailable.
The canonical project remains `edu-signal`; the duplicate `edu-signal-ct`
project requires manual dashboard cleanup if still connected.

## Resolved Issues

No code fixes were applied during M4.5. The audit branch and this report were
created without changing product behavior. Existing runtime cleanup from M0.5
was verified locally.

## Unresolved Issues

1. Link the Supabase development project and run live Auth/RLS checks.
2. Complete M2 Student Workspace.
3. Complete M3 Learning Modules.
4. Complete M4 Activity Engine.
5. Add enrollment uniqueness before enrollment-dependent features.
6. Resolve or formally accept dependency vulnerabilities.
7. Verify a Vercel deployment reaches `READY`.

## Technical Debt

- Historical identity tables remain in the schema.
- `students.profile_id` remains nullable for migration compatibility.
- Supabase and Drizzle migration execution requires documented project setup.
- `metadataBase` is not configured.
- Node 22 is required; audit environment used Node 24.

## M5 Recommendation

Do not begin M5. Complete and live-verify M1.5, M2, M3, and M4 first. The
current system is not stable for M5.

## Post-audit implementation

The audit branch subsequently implemented the missing local M2–M4 paths
without adding M5: student enrollment-derived workspace routes, teacher module
publication/editing, validated learning activities, working responses, and
derived progress. Drizzle migration `0002_short_roulette.sql` adds the three
activity tables, indexes, uniqueness rules, and enrollment uniqueness; Supabase
migration `0005_m2_m4_rls.sql` adds membership/publication policies and
`0006_m2_student_record_trigger.sql` creates academic student records for new
Auth users.

Local verification now passes TypeScript, lint, migration generation, build,
and ten regression tests. Live Supabase/Auth/RLS and Vercel verification remain
external prerequisites and are intentionally not reported as passed here.
