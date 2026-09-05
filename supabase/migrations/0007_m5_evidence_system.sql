-- M5 canonical student-owned evidence model. Drizzle owns relational schema;
-- this companion owns RLS and Storage policies. Legacy rows remain readable.
alter table public.learning_activities add column if not exists requires_evidence boolean not null default false;
alter table public.evidences add column if not exists module_id text references public.learning_modules(id);
alter table public.evidences add column if not exists activity_id text references public.learning_activities(id);
alter table public.evidences add column if not exists evidence_type text;
alter table public.evidences add column if not exists text_content text;
alter table public.evidences add column if not exists external_url text;
alter table public.evidences add column if not exists file_name text;
alter table public.evidences add column if not exists mime_type text;
alter table public.evidences add column if not exists file_size integer;
update public.evidences set evidence_type = case when storage_key is not null then 'file' else 'text' end where evidence_type is null;
alter table public.evidences drop column if exists kind;
alter table public.evidences alter column evidence_type set default 'text';
alter table public.evidences alter column evidence_type set not null;
alter table public.evidences alter column status set default 'draft';
alter table public.evidences alter column submitted_at drop default;
alter table public.evidences alter column submitted_at drop not null;
alter table public.evidences drop constraint if exists evidences_status_check;
alter table public.evidences add constraint evidences_status_check check (status in ('draft', 'submitted'));
alter table public.evidences drop constraint if exists evidences_type_check;
alter table public.evidences add constraint evidences_type_check check (evidence_type in ('text', 'file', 'link'));
create index if not exists idx_evidences_module on public.evidences(module_id);
create index if not exists idx_evidences_activity on public.evidences(activity_id);
create index if not exists idx_evidences_status on public.evidences(status);
create unique index if not exists uq_evidences_student_activity on public.evidences(student_id, activity_id) where activity_id is not null;

alter table public.evidences enable row level security;
drop policy if exists "students_read_own_evidence" on public.evidences;
drop policy if exists "students_insert_own_draft_evidence" on public.evidences;
drop policy if exists "students_update_own_draft_evidence" on public.evidences;
drop policy if exists "students_delete_own_draft_evidence" on public.evidences;
drop policy if exists "teachers_read_submitted_owned_evidence" on public.evidences;
drop policy if exists "students_upload_own_evidence_file" on storage.objects;
drop policy if exists "students_read_own_evidence_file" on storage.objects;
drop policy if exists "teachers_read_submitted_evidence_file" on storage.objects;
drop policy if exists "students_update_own_evidence_file" on storage.objects;
drop policy if exists "students_delete_own_evidence_file" on storage.objects;
create policy "students_read_own_evidence" on public.evidences for select to authenticated using (exists (select 1 from public.students s where s.id = student_id and s.profile_id = auth.uid()));
create policy "students_insert_own_draft_evidence" on public.evidences for insert to authenticated with check (status = 'draft' and exists (select 1 from public.students s join public.enrollments e on e.student_id = s.id where s.id = student_id and s.profile_id = auth.uid() and e.classroom_id = evidences.classroom_id and e.status = 'active'));
create policy "students_update_own_draft_evidence" on public.evidences for update to authenticated using (status = 'draft' and exists (select 1 from public.students s where s.id = student_id and s.profile_id = auth.uid())) with check (status = 'draft' and exists (select 1 from public.students s join public.enrollments e on e.student_id = s.id where s.id = student_id and s.profile_id = auth.uid() and e.classroom_id = evidences.classroom_id and e.status = 'active'));
create policy "students_delete_own_draft_evidence" on public.evidences for delete to authenticated using (status = 'draft' and exists (select 1 from public.students s where s.id = student_id and s.profile_id = auth.uid()));
create policy "teachers_read_submitted_owned_evidence" on public.evidences for select to authenticated using (status = 'submitted' and exists (select 1 from public.classrooms c where c.id = classroom_id and c.teacher_id = auth.uid()));

create policy "students_upload_own_evidence_file" on storage.objects for insert to authenticated with check (bucket_id = 'evidence' and exists (select 1 from public.evidences e join public.students s on s.id = e.student_id where e.status = 'draft' and s.profile_id = auth.uid() and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'));
create policy "students_read_own_evidence_file" on storage.objects for select to authenticated using (bucket_id = 'evidence' and exists (select 1 from public.evidences e join public.students s on s.id = e.student_id where s.profile_id = auth.uid() and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'));
create policy "teachers_read_submitted_evidence_file" on storage.objects for select to authenticated using (bucket_id = 'evidence' and exists (select 1 from public.evidences e join public.classrooms c on c.id = e.classroom_id where e.status = 'submitted' and c.teacher_id = auth.uid() and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'));
create policy "students_update_own_evidence_file" on storage.objects for update to authenticated using (bucket_id = 'evidence' and exists (select 1 from public.evidences e join public.students s on s.id = e.student_id where e.status = 'draft' and s.profile_id = auth.uid() and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'));
create policy "students_delete_own_evidence_file" on storage.objects for delete to authenticated using (bucket_id = 'evidence' and exists (select 1 from public.evidences e join public.students s on s.id = e.student_id where e.status = 'draft' and s.profile_id = auth.uid() and name like e.classroom_id || '/' || e.student_id || '/' || e.id || '/%'));

create or replace function public.validate_evidence_lifecycle() returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and OLD.status = 'submitted' then raise exception 'submitted evidence is immutable'; end if;
  if NEW.status = 'submitted' then
    if NEW.evidence_type = 'text' and nullif(btrim(NEW.text_content), '') is null then raise exception 'submitted text evidence requires text_content'; end if;
    if NEW.evidence_type = 'link' and (NEW.external_url is null or NEW.external_url !~ '^https://') then raise exception 'submitted link evidence requires an HTTPS URL'; end if;
    if NEW.evidence_type = 'file' and nullif(btrim(NEW.storage_key), '') is null then raise exception 'submitted file evidence requires storage_key'; end if;
  end if;
  if NEW.activity_id is not null and NEW.module_id is null then raise exception 'activity-backed evidence requires module_id'; end if;
  return NEW;
end $$;
drop trigger if exists evidence_lifecycle_guard on public.evidences;
create trigger evidence_lifecycle_guard before insert or update on public.evidences for each row execute function public.validate_evidence_lifecycle();
