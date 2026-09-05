# M5 — Evidence System

## Goal
Formalize student-owned learning evidence without conflating it with activity responses.

## Evidence Model
`activity_responses` stores work/interactions inside an activity. `evidences` stores a formal artifact linked to the student, classroom, module and activity. New activity-backed evidence is unique per student/activity; historical teacher-created rows remain nullable on module/activity.

## Evidence Types
`text`, `link` and `file`. Text stores escaped plain text, links require HTTPS, and files store metadata plus a private Storage path.

## Submission Lifecycle
New records are `draft`; students may edit or delete drafts. Submission validates the selected type, sets `submitted` and uses a server timestamp. Submitted records are immutable in the student API.

## Storage Architecture
Supabase Storage bucket `evidence` is private. Paths are generated as `classroom/student/evidence/safe-filename`. Files are limited to 10 MB and an allowlist of MIME types/extensions. Signed URLs use a 120-second TTL and are generated only after resource authorization. Deep content scanning is deferred.

## Student Flow
An activity with `requires_evidence=true` exposes the evidence composer. Student creates a draft, saves text/link or uploads a file, then submits. Drafts never satisfy completion; submitted evidence can satisfy it.

## Teacher Visibility
The existing teacher registry remains a compatibility route for historical artifacts. Its list is limited to submitted evidence in owned classrooms. M5 student records are not teacher-editable.

## RLS and Security
Evidence policies scope students to their own rows and teachers to submitted rows in owned classrooms. Storage policies scope object names to evidence ownership/classroom ownership. Server authorization is performed before privileged Storage operations.

## Migration Authority
`drizzle-postgres/` is the authority for PostgreSQL tables, columns, constraints, indexes and evidence lifecycle triggers. `supabase/migrations/` is a deployment companion for RLS and Storage policies and mirrors the M5 relational guards needed by Supabase. Apply Drizzle migrations first, then Supabase migrations in filename order. The M5 policy migration drops and recreates its named policies, so it is safe to rerun. Historical SQLite files under `drizzle/` are not part of this path.

`drizzle-postgres/0003_m5_evidence_system.sql` is the committed compatibility migration authority. The no-argument `npm run db:generate` command is an idempotent check and does not invoke Drizzle's interactive column-conflict resolver or create duplicate migrations. Deliberate schema generation remains available by passing explicit Drizzle arguments to the script and requires reviewing the generated diff.

## M6 Handoff
M6 may add evaluation and feedback records against `evidences`; it must not mutate submitted evidence or introduce grading states into the M5 lifecycle.

## Definition of Done
Schema migration, ownership checks, draft/submission lifecycle, private Storage, signed downloads, evidence-aware completion, regression coverage and migration dry-run are required. Live multi-user acceptance remains a separate gate.
