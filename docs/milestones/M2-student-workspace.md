# M2 Student Workspace

## Goal

Give authenticated students a learning-first workspace backed by real
enrollments, classrooms, and published modules.

## Student Journey

`auth.users` resolves to `profiles`, then to the academic `students` row via
`students.profile_id`. Active enrollments determine visible classrooms;
published modules in those classrooms determine the dashboard and module
preview.

## Data Model

```text
auth.users → profiles → students → enrollments → classrooms → learning_modules
```

The academic student ID remains a text primary key for compatibility; the
profile bridge is unique and UUID-based.

## Student Context Resolution

`lib/student/require-student.ts` calls the server-side Auth guard and resolves
the student record from the authenticated profile. No student route accepts a
client-provided student ID as identity.

## RLS

Student policies scope records through `students.profile_id = auth.uid()` and
active enrollments. Classroom/module queries additionally require active
membership and published state. Teacher ownership policies remain scoped to
`classrooms.teacher_id`.

## Routes

- `/student`: dashboard with active classrooms and published modules.
- `/student/classrooms`: enrolled classroom list.
- `/student/classrooms/[classroomId]`: authorized classroom and modules.
- `/student/modules/[moduleId]`: authorized published module preview.

## Security

Resource IDs are selectors only. Each server query joins the current student,
enrollment, classroom, and published resource before rendering. Unknown or
foreign resources resolve to `notFound()`.

## UX

The student surface uses a responsive, learning-first shell with real empty
states, semantic landmarks, links, visible action labels, and no artificial
progress, signals, notifications, or grades.

## Testing

Local tests cover source-level guards and runtime build. Live Student A/B RLS
verification requires a linked Supabase project and seeded accounts.

## Known Limitations

No complete live Supabase smoke test is available in this environment. Teacher
and student demo data must be seeded with Auth UUIDs before the pages show data.

## M3 Handoff

M3 can extend the teacher module manager and publication lifecycle without
changing student identity resolution.
