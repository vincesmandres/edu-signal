-- Applied only to the local Supabase project after auth users are created.
-- IDs are deterministic and contain no real credentials or personal data.
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'Teacher A', 'teacher'),
  ('00000000-0000-4000-8000-0000000000b1', 'Teacher B', 'teacher'),
  ('00000000-0000-4000-8000-0000000000a2', 'Student A', 'student'),
  ('00000000-0000-4000-8000-0000000000b2', 'Student B', 'student')
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;
insert into public.classrooms (id, name, subject, academic_period, teacher_id) values
  ('class-a', 'Classroom A', 'Science', 'test', '00000000-0000-4000-8000-0000000000a1'),
  ('class-b', 'Classroom B', 'Science', 'test', '00000000-0000-4000-8000-0000000000b1') on conflict (id) do nothing;
insert into public.students (id, profile_id, display_name, email) values
  ('student-a', '00000000-0000-4000-8000-0000000000a2', 'Student A', 'student-a@test.local'),
  ('student-b', '00000000-0000-4000-8000-0000000000b2', 'Student B', 'student-b@test.local') on conflict (id) do nothing;
insert into public.enrollments (id, student_id, classroom_id, status) values
  ('enroll-a', 'student-a', 'class-a', 'active'), ('enroll-b', 'student-b', 'class-b', 'active') on conflict (id) do update set status = excluded.status;
insert into public.learning_modules (id, classroom_id, title, driving_question, methodologies) values
  ('module-a', 'class-a', 'Module A', 'Question A', 'project') on conflict (id) do nothing;
insert into public.learning_activities (id, module_id, title, activity_type, requires_evidence, status) values
  ('activity-a', 'module-a', 'Activity A', 'text', true, 'published') on conflict (id) do nothing;
insert into public.rubrics (id, classroom_id, title, status) values ('rubric-a', 'class-a', 'Rubric A', 'published') on conflict (id) do nothing;
insert into public.rubric_criteria (id, rubric_id, name, description, max_score, position) values ('criterion-a', 'rubric-a', 'Criterion A', 'Criterion', '4', '1') on conflict (id) do nothing;
