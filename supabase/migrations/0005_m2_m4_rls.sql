-- Access policies for the student workspace and activity engine.
-- The checks resolve the authenticated user through students.profile_id.
alter table public.learning_activities enable row level security;
alter table public.activity_responses enable row level security;
alter table public.student_activity_progress enable row level security;

create policy "students_read_own_record" on public.students
  for select to authenticated using (profile_id = auth.uid());

create policy "students_read_own_enrollments" on public.enrollments
  for select to authenticated using (
    exists (select 1 from public.students s where s.id = student_id and s.profile_id = auth.uid())
  );

create policy "students_read_enrolled_classrooms" on public.classrooms
  for select to authenticated using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.classroom_id = classrooms.id and e.status = 'active' and s.profile_id = auth.uid()
    )
  );

create policy "students_read_published_modules" on public.learning_modules
  for select to authenticated using (
    phase = 'published' and exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.classroom_id = learning_modules.classroom_id
        and e.status = 'active' and s.profile_id = auth.uid()
    )
  );

create policy "students_read_published_activities" on public.learning_activities
  for select to authenticated using (
    status = 'published' and exists (
      select 1 from public.learning_modules m
      join public.enrollments e on e.classroom_id = m.classroom_id
      join public.students s on s.id = e.student_id
      where m.id = learning_activities.module_id and m.phase = 'published'
        and e.status = 'active' and s.profile_id = auth.uid()
    )
  );

create policy "students_manage_own_responses" on public.activity_responses
  for all to authenticated using (
    exists (
      select 1 from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.learning_activities a on a.id = activity_id
      join public.learning_modules m on m.id = a.module_id and m.classroom_id = e.classroom_id
      where s.id = activity_responses.student_id and s.profile_id = auth.uid()
        and e.status = 'active' and a.status = 'published' and m.phase = 'published'
    )
  ) with check (
    exists (
      select 1 from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.learning_activities a on a.id = activity_id
      join public.learning_modules m on m.id = a.module_id and m.classroom_id = e.classroom_id
      where s.id = activity_responses.student_id and s.profile_id = auth.uid()
        and e.status = 'active' and a.status = 'published' and m.phase = 'published'
    )
  );

create policy "students_manage_own_progress" on public.student_activity_progress
  for all to authenticated using (
    exists (
      select 1 from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.learning_activities a on a.id = activity_id
      join public.learning_modules m on m.id = a.module_id and m.classroom_id = e.classroom_id
      where s.id = student_activity_progress.student_id and s.profile_id = auth.uid()
        and e.status = 'active' and a.status = 'published' and m.phase = 'published'
    )
  ) with check (
    exists (
      select 1 from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.learning_activities a on a.id = activity_id
      join public.learning_modules m on m.id = a.module_id and m.classroom_id = e.classroom_id
      where s.id = student_activity_progress.student_id and s.profile_id = auth.uid()
        and e.status = 'active' and a.status = 'published' and m.phase = 'published'
    )
  );

create policy "teachers_manage_owned_classrooms" on public.classrooms
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "teachers_manage_owned_modules" on public.learning_modules
  for all to authenticated using (
    exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
  );

create policy "teachers_read_owned_students" on public.students
  for select to authenticated using (
    exists (
      select 1 from public.enrollments e join public.classrooms c on c.id = e.classroom_id
      where e.student_id = students.id and c.teacher_id = auth.uid()
    )
  );

create policy "teachers_read_owned_enrollments" on public.enrollments
  for select to authenticated using (
    exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
  );

create policy "teachers_manage_owned_activities" on public.learning_activities
  for all to authenticated using (
    exists (
      select 1 from public.learning_modules m join public.classrooms c on c.id = m.classroom_id
      where m.id = module_id and c.teacher_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.learning_modules m join public.classrooms c on c.id = m.classroom_id
      where m.id = module_id and c.teacher_id = auth.uid()
    )
  );

create policy "teachers_read_owned_responses" on public.activity_responses
  for select to authenticated using (
    exists (
      select 1 from public.learning_activities a
      join public.learning_modules m on m.id = a.module_id
      join public.classrooms c on c.id = m.classroom_id
      where a.id = activity_id and c.teacher_id = auth.uid()
    )
  );

create policy "teachers_read_owned_progress" on public.student_activity_progress
  for select to authenticated using (
    exists (
      select 1 from public.learning_activities a
      join public.learning_modules m on m.id = a.module_id
      join public.classrooms c on c.id = m.classroom_id
      where a.id = activity_id and c.teacher_id = auth.uid()
    )
  );
