-- M1 makes Supabase Auth the only authentication authority.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    if new.role is distinct from old.role or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'profile identity and role are managed by an administrator';
    end if;
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_change();

-- Domain tables remain deny-by-default until classroom membership policies are
-- designed. No public client can use the legacy identity tables.
