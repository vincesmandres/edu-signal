# M3 Learning Modules

## Goal

Provide a teacher-owned module lifecycle while exposing only published modules
to enrolled students.

## Module Model

The existing `learning_modules` model is preserved: title, driving question,
methodologies, classroom, and `phase`. The phases are `draft`, `published`,
and `archived`.

## Teacher Flow

Teachers reach a module from their classroom, edit title/question, publish,
unpublish, archive, and manage its activities. Ownership is verified through
`classrooms.teacher_id = auth.uid()` on every server request.

## Student Flow

Student module queries require an active enrollment in the module classroom and
`phase = 'published'`. Draft and archived modules are not rendered or exposed.

## Security

No module ID alone grants access. Foreign classroom and module IDs return a
safe not-found result. RLS policies mirror the server-side ownership checks.

## M4 Handoff

Activities attach to modules without changing module identity or publication
semantics. An activity is visible only when both its module and its own status
are published.
