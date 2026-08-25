-- Every public student signup receives its academic record atomically with the
-- profile. The text ID remains compatible with existing educational FKs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  safe_name text;
begin
  safe_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1));
  insert into public.profiles (id, display_name, role)
  values (new.id, safe_name, 'student')
  on conflict (id) do nothing;
  insert into public.students (id, profile_id, display_name, email)
  values (new.id::text, new.id, safe_name, new.email)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

alter table public.learning_activities
  add constraint learning_activities_type_check
  check (activity_type in ('instruction', 'question', 'prediction', 'simulation', 'external_link', 'reflection', 'reading'));
alter table public.learning_activities
  add constraint learning_activities_status_check
  check (status in ('draft', 'published', 'archived'));
alter table public.activity_responses
  add constraint activity_responses_status_check
  check (status in ('draft', 'submitted'));
alter table public.student_activity_progress
  add constraint activity_progress_status_check
  check (status in ('not_started', 'in_progress', 'completed'));
