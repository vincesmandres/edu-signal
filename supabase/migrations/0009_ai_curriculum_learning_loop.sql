-- AI curriculum studio and deep-learning loop security boundary.
-- Relational tables are created first by drizzle-postgres/0005.

alter table public.learning_activities drop constraint if exists learning_activities_type_check;
alter table public.learning_activities add constraint learning_activities_type_check
  check (activity_type in ('instruction', 'question', 'prediction', 'simulation', 'external_link', 'reflection', 'reading', 'inquiry_cycle'));

alter table public.curriculum_generations enable row level security;
alter table public.ai_usage_records enable row level security;
alter table public.teacher_materials enable row level security;
alter table public.activity_rubrics enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.activity_response_versions enable row level security;
alter table public.self_assessments enable row level security;
alter table public.self_assessment_criteria enable row level security;
alter table public.formative_feedback enable row level security;
alter table public.teacher_reviews enable row level security;
alter table public.teacher_review_criteria enable row level security;
alter table public.grades enable row level security;
alter table public.grade_imports enable row level security;

create or replace function public.ai_loop_teacher_classroom(classroom_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.classrooms c
  where c.id = classroom_key and c.teacher_id = (select auth.uid())
) $$;

create or replace function public.ai_loop_teacher_activity(activity_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.learning_activities a
  join public.learning_modules m on m.id = a.module_id
  join public.classrooms c on c.id = m.classroom_id
  where a.id = activity_key and c.teacher_id = (select auth.uid())
) $$;

create or replace function public.ai_loop_student_activity(student_key text, activity_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.students s
  join public.enrollments e on e.student_id = s.id and e.status = 'active'
  join public.learning_modules m on m.classroom_id = e.classroom_id and m.phase = 'published'
  join public.learning_activities a on a.module_id = m.id and a.status = 'published'
  where s.id = student_key and s.profile_id = (select auth.uid()) and a.id = activity_key
) $$;

create or replace function public.ai_loop_student_attempt(attempt_key text, require_draft boolean default false)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.activity_attempts aa
  where aa.id = attempt_key
    and (not require_draft or aa.status in ('draft', 'returned'))
    and public.ai_loop_student_activity(aa.student_id, aa.activity_id)
) $$;

create or replace function public.ai_loop_student_response(version_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.activity_response_versions rv
  where rv.id = version_key and public.ai_loop_student_attempt(rv.attempt_id, false)
) $$;

create or replace function public.ai_loop_teacher_response(version_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.activity_response_versions rv
  join public.activity_attempts aa on aa.id = rv.attempt_id
  where rv.id = version_key and public.ai_loop_teacher_activity(aa.activity_id)
) $$;

create or replace function public.ai_loop_teacher_material_file(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
  select 1 from public.teacher_materials tm
  where tm.teacher_id = (select auth.uid())
    and position('..' in object_name) = 0
    and object_name not like '/%'
    and array_length(string_to_array(object_name, '/'), 1) = 3
    and object_name like tm.teacher_id::text || '/' || tm.id || '/%'
    and tm.storage_key = object_name
) $$;

revoke all on function public.ai_loop_teacher_classroom(text) from public;
revoke all on function public.ai_loop_teacher_activity(text) from public;
revoke all on function public.ai_loop_student_activity(text, text) from public;
revoke all on function public.ai_loop_student_attempt(text, boolean) from public;
revoke all on function public.ai_loop_student_response(text) from public;
revoke all on function public.ai_loop_teacher_response(text) from public;
revoke all on function public.ai_loop_teacher_material_file(text) from public;
grant execute on function public.ai_loop_teacher_classroom(text), public.ai_loop_teacher_activity(text), public.ai_loop_student_activity(text, text), public.ai_loop_student_attempt(text, boolean), public.ai_loop_student_response(text), public.ai_loop_teacher_response(text), public.ai_loop_teacher_material_file(text) to authenticated;

grant select, insert, update on public.curriculum_generations to authenticated;
grant select on public.ai_usage_records to authenticated;
grant select, insert, update, delete on public.teacher_materials to authenticated;
grant select, insert, update, delete on public.activity_rubrics to authenticated;
grant select, insert, update on public.activity_attempts to authenticated;
grant select, insert, update on public.activity_response_versions to authenticated;
grant select, insert, update on public.self_assessments, public.self_assessment_criteria to authenticated;
grant select (id, response_version_id, status, feedback, source, created_at, updated_at) on public.formative_feedback to authenticated;
grant select (id, response_version_id, teacher_id, status, public_feedback, required_improvements, published_at, returned_at, created_at, updated_at), insert, update on public.teacher_reviews to authenticated;
grant select, insert, update on public.teacher_review_criteria to authenticated;
grant select, insert, update on public.grades, public.grade_imports to authenticated;

create policy "teachers_manage_own_generations" on public.curriculum_generations for all to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "actors_read_own_ai_usage" on public.ai_usage_records for select to authenticated
  using (actor_profile_id = (select auth.uid()));
create policy "teachers_manage_own_materials" on public.teacher_materials for all to authenticated
  using (teacher_id = (select auth.uid()) and (classroom_id is null or public.ai_loop_teacher_classroom(classroom_id)))
  with check (teacher_id = (select auth.uid()) and (classroom_id is null or public.ai_loop_teacher_classroom(classroom_id)) and (generation_id is null or exists (select 1 from public.curriculum_generations cg where cg.id = generation_id and cg.teacher_id = (select auth.uid()))));
create policy "teachers_manage_activity_rubrics" on public.activity_rubrics for all to authenticated
  using (public.ai_loop_teacher_activity(activity_id)) with check (public.ai_loop_teacher_activity(activity_id));
create policy "students_read_activity_rubrics" on public.activity_rubrics for select to authenticated
  using (exists (select 1 from public.activity_attempts aa where aa.activity_id = activity_id and public.ai_loop_student_activity(aa.student_id, aa.activity_id)));

create policy "students_read_own_attempts" on public.activity_attempts for select to authenticated
  using (public.ai_loop_student_activity(student_id, activity_id));
create policy "students_insert_own_attempts" on public.activity_attempts for insert to authenticated
  with check (status = 'draft' and current_revision = 0 and public.ai_loop_student_activity(student_id, activity_id));
create policy "students_update_current_attempt" on public.activity_attempts for update to authenticated
  using (status in ('draft', 'returned') and public.ai_loop_student_activity(student_id, activity_id))
  with check (public.ai_loop_student_activity(student_id, activity_id));
create policy "teachers_read_owned_attempts" on public.activity_attempts for select to authenticated
  using (public.ai_loop_teacher_activity(activity_id));

create policy "students_read_own_response_versions" on public.activity_response_versions for select to authenticated
  using (public.ai_loop_student_attempt(attempt_id, false));
create policy "students_insert_current_response_version" on public.activity_response_versions for insert to authenticated
  with check (status = 'draft' and public.ai_loop_student_attempt(attempt_id, true) and revision = (select current_revision from public.activity_attempts where id = attempt_id));
create policy "students_update_current_draft_response" on public.activity_response_versions for update to authenticated
  using (status = 'draft' and public.ai_loop_student_attempt(attempt_id, true))
  with check (public.ai_loop_student_attempt(attempt_id, true));
create policy "teachers_read_owned_response_versions" on public.activity_response_versions for select to authenticated
  using (public.ai_loop_teacher_response(id));

create policy "students_manage_own_self_assessment" on public.self_assessments for all to authenticated
  using (public.ai_loop_student_response(response_version_id)) with check (public.ai_loop_student_response(response_version_id));
create policy "teachers_read_owned_self_assessment" on public.self_assessments for select to authenticated
  using (public.ai_loop_teacher_response(response_version_id));
create policy "students_manage_own_self_assessment_criteria" on public.self_assessment_criteria for all to authenticated
  using (exists (select 1 from public.self_assessments sa where sa.id = self_assessment_id and public.ai_loop_student_response(sa.response_version_id)))
  with check (exists (select 1 from public.self_assessments sa where sa.id = self_assessment_id and public.ai_loop_student_response(sa.response_version_id)));
create policy "teachers_read_owned_self_assessment_criteria" on public.self_assessment_criteria for select to authenticated
  using (exists (select 1 from public.self_assessments sa where sa.id = self_assessment_id and public.ai_loop_teacher_response(sa.response_version_id)));

create policy "students_read_own_formative_feedback" on public.formative_feedback for select to authenticated
  using (status = 'completed' and public.ai_loop_student_response(response_version_id));
create policy "teachers_read_owned_formative_feedback" on public.formative_feedback for select to authenticated
  using (public.ai_loop_teacher_response(response_version_id));

create policy "teachers_manage_owned_reviews" on public.teacher_reviews for all to authenticated
  using (teacher_id = (select auth.uid()) and public.ai_loop_teacher_response(response_version_id))
  with check (teacher_id = (select auth.uid()) and public.ai_loop_teacher_response(response_version_id));
create policy "students_read_published_reviews" on public.teacher_reviews for select to authenticated
  using (status = 'published' and public.ai_loop_student_response(response_version_id));
create policy "teachers_manage_owned_review_criteria" on public.teacher_review_criteria for all to authenticated
  using (exists (select 1 from public.teacher_reviews tr where tr.id = review_id and tr.teacher_id = (select auth.uid()) and public.ai_loop_teacher_response(tr.response_version_id)))
  with check (exists (select 1 from public.teacher_reviews tr where tr.id = review_id and tr.teacher_id = (select auth.uid()) and public.ai_loop_teacher_response(tr.response_version_id)));
create policy "students_read_published_review_criteria" on public.teacher_review_criteria for select to authenticated
  using (exists (select 1 from public.teacher_reviews tr where tr.id = review_id and tr.status = 'published' and public.ai_loop_student_response(tr.response_version_id)));

create policy "teachers_manage_owned_grades" on public.grades for all to authenticated
  using (public.ai_loop_teacher_classroom(classroom_id)) with check (public.ai_loop_teacher_classroom(classroom_id));
create policy "students_read_published_grades" on public.grades for select to authenticated
  using (status = 'published' and public.m62_student_owns(student_id) and public.m62_student_enrolled(classroom_id));
create policy "teachers_manage_owned_grade_imports" on public.grade_imports for all to authenticated
  using (teacher_id = (select auth.uid()) and public.ai_loop_teacher_classroom(classroom_id))
  with check (teacher_id = (select auth.uid()) and public.ai_loop_teacher_classroom(classroom_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-materials', 'teacher-materials', false, 20971520, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'image/png', 'image/jpeg', 'image/webp'
]) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "teachers_upload_own_materials" on storage.objects for insert to authenticated
  with check (bucket_id = 'teacher-materials' and public.ai_loop_teacher_material_file(name));
create policy "teachers_read_own_materials" on storage.objects for select to authenticated
  using (bucket_id = 'teacher-materials' and public.ai_loop_teacher_material_file(name));
create policy "teachers_update_own_materials" on storage.objects for update to authenticated
  using (bucket_id = 'teacher-materials' and public.ai_loop_teacher_material_file(name))
  with check (bucket_id = 'teacher-materials' and public.ai_loop_teacher_material_file(name));
create policy "teachers_delete_own_materials" on storage.objects for delete to authenticated
  using (bucket_id = 'teacher-materials' and public.ai_loop_teacher_material_file(name));
