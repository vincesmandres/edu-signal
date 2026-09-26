-- M6.2: non-recursive evidence and Storage policies.
-- All helpers are SECURITY DEFINER, have a fixed search_path, and are not public.
create or replace function public.m62_student_owns(student_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.students s
  where s.id = student_key and s.profile_id = (select auth.uid())
) $$;

create or replace function public.m62_student_enrolled(classroom_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.classroom_id = classroom_key and e.status = 'active'
    and s.profile_id = (select auth.uid())
) $$;

create or replace function public.m62_teacher_submitted(classroom_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.classrooms c
  where c.id = classroom_key and c.teacher_id = (select auth.uid())
) $$;

create or replace function public.m62_evidence_file_access(object_name text, require_draft boolean default false)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.evidences e
    join public.students s on s.id = e.student_id
    join public.enrollments en on en.student_id = e.student_id and en.classroom_id = e.classroom_id
    where s.profile_id = (select auth.uid())
      and en.status = 'active'
      and (not require_draft or e.status = 'draft')
      and position('..' in object_name) = 0
      and object_name not like '/%'
      and array_length(string_to_array(object_name, '/'), 1) = 4
      and object_name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'
  )
$$;

revoke all on function public.m62_student_owns(text) from public;
revoke all on function public.m62_student_enrolled(text) from public;
revoke all on function public.m62_teacher_submitted(text) from public;
revoke all on function public.m62_evidence_file_access(text, boolean) from public;
grant execute on function public.m62_student_owns(text), public.m62_student_enrolled(text), public.m62_teacher_submitted(text), public.m62_evidence_file_access(text, boolean) to authenticated;
grant select on public.students, public.enrollments, public.classrooms, public.learning_modules, public.learning_activities, public.evidences to authenticated;
grant insert, update, delete on public.evidences to authenticated;

drop policy if exists "students_read_own_enrollments" on public.enrollments;
create policy "students_read_own_enrollments" on public.enrollments for select to authenticated
  using (public.m62_student_owns(student_id));
drop policy if exists "students_read_enrolled_classrooms" on public.classrooms;
create policy "students_read_enrolled_classrooms" on public.classrooms for select to authenticated
  using (public.m62_student_enrolled(id));
drop policy if exists "students_read_published_modules" on public.learning_modules;
create policy "students_read_published_modules" on public.learning_modules for select to authenticated
  using (phase = 'published' and public.m62_student_enrolled(classroom_id));
drop policy if exists "students_read_published_activities" on public.learning_activities;
create policy "students_read_published_activities" on public.learning_activities for select to authenticated
  using (status = 'published' and exists (
    select 1 from public.learning_modules m
    where m.id = module_id and m.phase = 'published' and public.m62_student_enrolled(m.classroom_id)
  ));

drop policy if exists "students_read_own_evidence" on public.evidences;
drop policy if exists "students_insert_own_draft_evidence" on public.evidences;
drop policy if exists "students_update_own_draft_evidence" on public.evidences;
drop policy if exists "students_delete_own_draft_evidence" on public.evidences;
drop policy if exists "teachers_read_submitted_owned_evidence" on public.evidences;
create policy "students_read_own_evidence" on public.evidences for select to authenticated
  using (public.m62_student_owns(student_id));
create policy "students_insert_own_draft_evidence" on public.evidences for insert to authenticated
  with check (status = 'draft' and public.m62_student_owns(student_id) and public.m62_student_enrolled(classroom_id));
create policy "students_update_own_draft_evidence" on public.evidences for update to authenticated
  using (status = 'draft' and public.m62_student_owns(student_id) and public.m62_student_enrolled(classroom_id))
  with check (status = 'draft' and public.m62_student_owns(student_id) and public.m62_student_enrolled(classroom_id));
create policy "students_delete_own_draft_evidence" on public.evidences for delete to authenticated
  using (status = 'draft' and public.m62_student_owns(student_id) and public.m62_student_enrolled(classroom_id));
create policy "teachers_read_submitted_owned_evidence" on public.evidences for select to authenticated
  using (status = 'submitted' and public.m62_teacher_submitted(classroom_id));

drop policy if exists "students_upload_own_evidence_file" on storage.objects;
drop policy if exists "students_read_own_evidence_file" on storage.objects;
drop policy if exists "students_update_own_evidence_file" on storage.objects;
drop policy if exists "students_delete_own_evidence_file" on storage.objects;
drop policy if exists "teachers_read_submitted_evidence_file" on storage.objects;
create policy "students_upload_own_evidence_file" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.m62_evidence_file_access(name, true));
create policy "students_read_own_evidence_file" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.m62_evidence_file_access(name, false));
create policy "students_update_own_evidence_file" on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and public.m62_evidence_file_access(name, true))
  with check (bucket_id = 'evidence' and public.m62_evidence_file_access(name, true));
create policy "students_delete_own_evidence_file" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.m62_evidence_file_access(name, true));
create policy "teachers_read_submitted_evidence_file" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.m62_teacher_submitted(split_part(name, '/', 1)) and exists (
    select 1 from public.evidences e
    where e.classroom_id = split_part(name, '/', 1)
      and e.student_id = split_part(name, '/', 2)
      and e.id = split_part(name, '/', 3)
      and e.status = 'submitted'
      and array_length(string_to_array(name, '/'), 1) = 4
      and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'
  ));
