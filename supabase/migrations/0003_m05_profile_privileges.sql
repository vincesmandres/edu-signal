-- RLS alone does not restrict which columns an authenticated user can update.
-- Make display_name the only self-service profile field at the SQL privilege layer.
revoke insert, update, delete on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
