# M4 Activity Engine

## Goal

Add reusable, ordered learning activities with simple text responses and real
student progress. Formal evidence remains out of scope for M5.

## Activity Model

`learning_activities` stores `module_id`, title, instructions, validated JSONB
config, type, position, required flag, lifecycle status, and publication time.
`activity_responses` stores one working response per student/activity.
`student_activity_progress` stores one idempotent state per student/activity.

## Activity Types

Supported types are `instruction`, `reading`, `question`, `prediction`,
`simulation`, `external_link`, and `reflection`. Config validation rejects
missing prompts/content and non-HTTPS resource URLs.

## Teacher Flow

Teacher-owned module routes create activities in draft, edit configuration,
publish/unpublish, archive, and order with `position`. Ownership is checked on
the module's classroom before every write.

## Student Flow

Students see only activities belonging to enrolled classrooms where both the
module and activity are published. Text activities require a saved response
before completion; resource/instruction activities can be completed directly.

## Activity Lifecycle

```text
```

Archiving hides an activity without deleting historical response/progress rows.

## Response Model

Responses are working text, not formal evidence. They are upserted on the
unique `(student_id, activity_id)` pair and can be saved before completion.

## Progress Model

Progress is derived as completed required published activities divided by total
required published activities. No percentage is persisted or fabricated.

## RLS

Students can manage only their own responses/progress. Teachers can manage
activities in owned modules and read responses/progress from owned classrooms.
Student activity reads require published module, published activity, and active
enrollment.

## Security

All student writes derive identity from Auth. Completion checks activity
visibility and requires a response for question/prediction/reflection. URLs are
HTTPS-only.

## M5 Handoff

M5 may convert selected working responses into formal evidence artifacts. It
must not reinterpret existing response rows as evidence automatically.

## Live verification

`npm run verify:live` uses only the public Supabase anon key and development
credentials supplied through environment variables. It verifies Student A/B
profile isolation, teacher/student roles, role escalation denial, and the
deployed `/api/health` response without printing credentials.

## Development seed

Run `npm run auth:seed` with server-only passwords, then run
`npm run db:seed:m4` with the printed Auth IDs. The seed creates Student A/B,
separate classrooms, a published and draft module, and published/draft
activities without real personal data.
