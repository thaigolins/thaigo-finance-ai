-- Fix mutable search_path on tg_set_updated_at
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lock down EXECUTE on SECURITY DEFINER functions
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
-- handle_new_user is invoked by trigger on auth.users; only the trigger needs to call it.
