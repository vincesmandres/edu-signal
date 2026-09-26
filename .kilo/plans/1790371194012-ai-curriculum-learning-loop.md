# AI Curriculum Studio and Deep Learning Loop

## Goal

Turn Edu Signal from a manual classroom CRUD into a teacher copilot that generates an editable classroom plan from **topic + education level + duration**, then runs student activities that preserve evidence of reasoning, iteration and self-assessment. AI may provide formative feedback and proposed rubric scores, but only a teacher can publish an official grade.

## Product decisions

- Provider: OpenAI Responses API behind a server-only adapter; `OPENAI_API_KEY` and configurable `OPENAI_MODEL` are Worker secrets.
- Curriculum creation: generated preview first; teacher edits, locks or regenerates sections, then approves an atomic draft creation. Nothing is auto-published.
- Student AI use: permitted but declared. Do not claim to detect AI; assess traceable reasoning and revision instead.
- Required learning cycle: initial prediction/claim -> two interpretations -> evidence/source/simulation contrast -> critique of an alternative answer -> revised synthesis -> rubric self-assessment.
- Feedback: OpenAI processes pseudonymized text only; no name, email, storage path or unredacted file metadata. AI feedback is formative and must not reveal a model answer prematurely.
- Review: initial submission plus at most two revisions by default. Teacher may return work, save a draft review, add private notes, and publish feedback/grade.
- Grades: scale configurable per classroom (0-5, 0-10, 0-100, rubric levels), normalized internally to 0-100; students see only published grades.
- Standards: optional country/framework selection; fallback to generic STEAM competencies. Standards/resources require verifiable citations.
- External resources: HTTPS and verified; allowlisted providers where applicable. Unverified candidates remain text suggestions without clickable URLs.
- Teacher uploads: private instructional materials plus CSV grade import/export.

## Current constraints to preserve

- Keep existing teacher ownership and student enrollment guards in `lib/authorization` and the RLS/storage policies.
- Keep legacy activities, `activity_responses`, evidence and immutable published evaluations readable. New workflow must be additive and migrate without deleting existing records.
- Submitted evidence remains an immutable artifact. Revisions are new submission snapshots referencing an optional evidence artifact rather than mutation of the submitted artifact.
- `credentials` remain achievements, not grades.
- Cloudflare database clients remain request-scoped as implemented in `db/index.ts`.

## Implementation plan

### 1. Provider, contracts and safety boundary

1. Add the official OpenAI SDK and Zod (or equivalent strict runtime schema validation).
2. Add `.env.example` entries for `OPENAI_API_KEY`, `OPENAI_MODEL`, generation/feedback token limits, and feature flags; add the same secrets to Cloudflare without exposing them to client bundles.
3. Create `lib/ai/provider.ts` and an OpenAI adapter with:
   - request timeout and abort handling;
   - structured JSON output only;
   - retry only for transient failures, never schema/auth errors;
   - model/prompt-version metadata;
   - safe error codes with no prompt or student content in logs;
   - usage/token accounting.
4. Add schemas in `lib/ai/contracts.ts` for generation input, full curriculum draft, activity learning-cycle config, rubric, verified resource, formative feedback and score proposal.
5. Add redaction/pseudonymization helpers and tests proving names, emails, auth identifiers, signed URLs and storage paths never enter student-feedback prompts.
6. Add per-teacher/student rate limits and daily usage records. Return 429 with a retry time; do not silently fall back to unvalidated content.

### 2. Additive database migration

Create `drizzle-postgres/0005_ai_curriculum_learning_loop.sql`, matching Drizzle snapshot/schema changes, and `supabase/migrations/0009_ai_curriculum_learning_loop.sql` for RLS/storage policies.

Add:

- `curriculum_generations`: teacher, sanitized input JSON, status (`pending|completed|failed|approved`), model, prompt version, draft JSON, locked sections, usage, error code, timestamps.
- Classroom settings columns/table: country/framework, education level, grade scale type/min/max/pass threshold.
- `teacher_materials`: classroom/generation owner, private storage key, safe filename/MIME/size, extraction status and sanitized extracted text/reference; private `teacher-materials` bucket.
- `activity_rubrics`: explicit activity-to-rubric link.
- New activity type `inquiry_cycle`; its validated config contains objective, estimated minutes, ordered stages, citation/resource requirements, AI-disclosure requirement and maximum revisions.
- `activity_attempts`: one student/activity record, workflow status, current revision and revision limit.
- `activity_response_versions`: immutable snapshot per attempt/revision containing stage responses, AI-use declaration and timestamps; unique attempt/revision.
- `self_assessments` and criterion rows: confidence, rubric self-score and rationale per response version.
- `formative_feedback`: structured strengths, misconceptions/gaps, contradictions, improvement statements, Socratic questions, next action and teacher-only proposed scores; source/model/prompt metadata.
- `teacher_reviews` and criterion scores: draft/returned/published status, public feedback, private notes, reviewer and reviewed response version. Only one published review per response version.
- `grades`: activity/module/classroom target, raw value, normalized percentage, scale snapshot, source review/import, draft/published status and audit history.
- `grade_imports`: teacher-owned CSV import metadata, validation summary and audit reference; never retain rejected raw rows unnecessarily.

Add constraints for revision range, score ranges, state transitions and ownership indexes. Enable RLS on every new table:

- teachers manage generations/materials/reviews/grades only through owned classrooms;
- students read published curriculum, their own attempts/versions/self-assessments/formative feedback and only published reviews/grades;
- students can write only their own current draft/revision;
- service role is used only for server AI operations, never browser access.

### 3. Curriculum generation API

Replace the stub `app/api/ai/module/route.ts` with focused routes:

- `POST /api/ai/curriculum/generations`: validate teacher input, material references and ownership; create pending job; generate a complete draft.
- `GET /api/ai/curriculum/generations/[id]`: owner-only status/draft retrieval.
- `POST /api/ai/curriculum/generations/[id]/regenerate`: regenerate selected unlocked section using the existing draft as context.
- `PATCH /api/ai/curriculum/generations/[id]`: validate teacher edits and locked sections.
- `POST /api/ai/curriculum/generations/[id]/approve`: revalidate the complete contract and create classroom, module, activities, rubric criteria, assessment links and grade settings in one transaction; retain everything as draft.

Generation contract must include:

- classroom title/subject/period suggestion;
- module title, driving question, rationale, objectives and cited standards;
- coherent ordered activities matched to duration;
- each activity’s deep-learning stages, evidence expectation and rubric mapping;
- complete multi-criterion rubric with observable descriptors;
- diagnostic, formative and summative checkpoints;
- verified resources with provider, URL and verification state;
- accessibility/differentiation suggestions;
- teacher warnings/assumptions that require review.

Verify URLs server-side with short timeouts, HTTPS enforcement and host allowlists. Reject unsafe schemes and strip unverifiable links. Record generation audit events without sensitive prompt bodies.

### 4. Teacher Curriculum Studio

Replace the overloaded manual classroom modal with a two-path entry: **Generate with AI** (primary) and **Create manually** (fallback).

Create a guided studio under `app/classrooms/generate`:

1. Input: topic, level and duration required; country/framework, methodology, learning goals, learner context and materials optional.
2. Generation progress with cancel/retry and explicit failure states.
3. Preview organized into Overview, Standards/Objectives, Sequence, Activities, Rubric and Resources.
4. Inline edit, lock section, regenerate section, reorder activities and validate warnings.
5. Student-preview mode showing exactly what learners will receive.
6. Approve to create drafts, then link to the existing module manager for final publication.

Replace raw activity JSON authoring with typed form controls for every activity type and the new inquiry cycle. Block module publication if required activities have invalid configs, missing rubric mappings or unverified required resources.

### 5. Deep-learning student experience

Add a dedicated `InquiryCycleRenderer` selected by `ActivityRenderer` for `inquiry_cycle`.

- Gate stages in order; autosave drafts without marking completion.
- Prediction is committed before later evidence/feedback is revealed.
- Require two genuinely distinct interpretations with labeled assumptions.
- Require source/simulation/observation citation and a statement of what it supports or contradicts.
- Present a generated or teacher-authored alternative/flawed answer for critique.
- Capture AI-use declaration: tool used, purpose, important suggestion, what was accepted/rejected, and why. “No AI used” remains valid.
- Require revised synthesis to reference what changed from the initial claim.
- Require rubric self-assessment and confidence before submission.
- Store one immutable response snapshot per submission/revision.
- Generate formative feedback after submission: strengths, gaps, contradictions, 2-3 Socratic questions and a concrete improvement action; never return a completed answer.
- Permit up to two revisions, preserving a readable before/after diff and improvement trajectory.
- Completion requires all configured stages, self-assessment and required evidence.

Use deterministic server validation for completeness/citations/stage order. AI cannot override authorization, completion or score constraints.

### 6. Teacher review and official grading

Extend the evidence inbox into a review queue with filters (`new|in_review|returned|ready_to_publish|published`).

Review detail must show:

- every response version and a stage-level diff;
- evidence/download through existing authorized routes;
- declared AI use;
- student self-assessment beside rubric criteria;
- formative feedback and teacher-only proposed rubric scores, clearly labeled as suggestions;
- editable criterion scores, public feedback, reusable improvement statements and private teacher notes.

Teacher actions:

- save draft review;
- return with required improvements (opens next revision if available);
- publish final review and official grade transactionally;
- reopen only through an audited correction flow, never overwrite grade history.

Build a classroom gradebook:

- rows by student, columns by graded activities/modules;
- raw scale and normalized score;
- draft/published distinction;
- saved filters and missing-work indicators;
- CSV template download, validation preview, atomic import and error report;
- CSV export of published grades;
- audit every import, publication and correction.

### 7. Student feedback and grade views

Extend student evidence/activity pages to show:

- formative feedback and improvement plan after each submission;
- self-assessment vs teacher rubric comparison;
- published official grade in the classroom scale plus normalized percentage;
- criterion feedback and next-step statements;
- version history and demonstrated changes;
- no draft teacher notes, draft grades or AI score proposals.

Add a student grade summary by classroom/module with clear “not graded”, “returned for revision” and “published” states.

### 8. Materials and CSV ingestion

- Teacher materials: accept PDF, DOCX, PPTX, TXT and supported images within an explicit size limit; private Storage paths scoped to teacher/classroom.
- Scan MIME/extension/size, extract or send supported file input server-side, redact obvious PII, and let the teacher choose which extracted sections inform generation.
- Treat uploaded material as untrusted prompt data; delimit it and prohibit embedded instructions from overriding system constraints.
- CSV grades: publish a strict template (`student identifier`, target, score, optional feedback); preview row-level validation before any write; require teacher confirmation; transact valid imports and provide rejected-row reasons.

### 9. Backward compatibility and rollout

1. Deploy schema/RLS first; all new features remain behind `AI_CURRICULUM_ENABLED` and `DEEP_LEARNING_LOOP_ENABLED`.
2. Keep legacy activity renderer and evaluation routes operational.
3. Backfill no artificial versions or grades. Existing responses/evaluations display through legacy adapters; new attempts use the new model.
4. Enable generation for demo teacher only, validate one complete module, then enable per classroom.
5. Apply OpenAI and storage quotas before general enablement.
6. Rollback by disabling flags; additive tables remain inert and legacy workflows continue.

## Validation

### Unit/contract

- Structured curriculum accepts complete coherent drafts and rejects missing objectives, duplicate positions, invalid rubric mappings, unsafe URLs and out-of-range durations.
- Inquiry-cycle state machine rejects skipped stages, overwritten snapshots, excess revisions and incomplete self-assessment.
- Grade normalization covers every configured scale and rounding boundary.
- Prompt redaction and prompt-injection delimiters have adversarial tests.

### Integration/database/RLS

- Generation approval is atomic: forced activity/rubric failure leaves no classroom fragments.
- Teacher A cannot read/regenerate/approve Teacher B generation or materials.
- Student A cannot read/write Student B attempts, feedback or grades.
- Students cannot read draft reviews, private notes or proposed AI scores.
- Returned work creates a new immutable revision and cannot mutate prior submissions.
- Only teacher publication creates/updates the official grade history.
- CSV validation/import is tenant-safe, atomic and audited.

### AI behavior

- Mock provider for deterministic CI; no live OpenAI calls in normal tests.
- Golden fixtures across subjects/levels verify schema, sequence coherence, rubric alignment and no invented clickable resources.
- Adversarial student text cannot change evaluator instructions or expose another learner.
- Feedback contains no answer completion, PII or unsupported certainty; failures leave the submission saved and expose a retryable feedback state.

### E2E

1. Teacher enters topic + level + duration, generates, edits one activity, regenerates another, approves and publishes.
2. Student completes all inquiry stages, declares AI use, self-assesses and submits.
3. Formative feedback appears; student revises twice with visible diffs.
4. Teacher reviews versions, saves a draft, returns once, then publishes rubric scores and grade.
5. Student sees published feedback/grade but never private notes or AI proposal.
6. Teacher exports grades and imports a validated CSV correction through the audited flow.

Run `npm run typecheck`, `npm run lint`, static/unit/API/DB/RLS tests, Next build, OpenNext build/dry-run, Playwright golden path, then deploy and run authenticated production smoke tests for teacher and student roles.

## Acceptance criteria

- A teacher can create a coherent editable draft classroom from topic, level and duration without manually authoring every component.
- No generated curriculum is persisted/published without teacher approval and strict validation.
- A student cannot complete a deep-learning activity with one generic text answer; all reasoning, contrast, critique, revision and self-assessment stages are persisted.
- AI use is transparently declared and evaluated through reasoning quality, not unreliable detection.
- AI feedback is formative; only a teacher can publish an official grade.
- Teacher can save draft reviews/private notes, return work, publish grades, and import/export grades.
- Student can see improvement statements, version progress, rubric feedback and only published grades.
- Authorization, RLS, audit, failure handling and legacy workflows remain green.