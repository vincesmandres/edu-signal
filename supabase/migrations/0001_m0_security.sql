-- M0 security baseline. Domain tables are server-owned until their complete
-- authenticated policies are designed in M1/M2.
alter table public.profiles enable row level security;
alter table public.educators enable row level security;
alter table public.sessions enable row level security;
alter table public.classrooms enable row level security;
alter table public.learning_modules enable row level security;
alter table public.assessments enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.evidences enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.credentials enable row level security;
alter table public.audit_events enable row level security;

alter table public.profiles
  add constraint profiles_id_auth_users_fk
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('teacher', 'student', 'coordinator', 'admin'));

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = excluded.public;

-- Upload/download policies are intentionally deferred until M1 identity and
-- classroom membership policies exist. The private bucket remains deny-by-default.
