-- 1. Revoke EXECUTE from anon/PUBLIC on SECURITY DEFINER functions that must not be publicly callable.
-- team_visible/play_visible intentionally stay executable (anon+authenticated) because the
-- public play-sharing RLS policies on plays/play_frames rely on them; they expose no sensitive data
-- and run with a fixed search_path.
revoke execute on function public.accept_invite(text) from anon, public;
revoke execute on function public.get_invite(text) from anon, public;
revoke execute on function public.is_head_coach() from anon, public;
revoke execute on function public.my_org_id() from anon, public;
revoke execute on function public.my_role() from anon, public;
-- handle_new_user is trigger-only; nobody should call it directly.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Re-grant to signed-in users only where the app legitimately calls them.
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.is_head_coach() to authenticated;
grant execute on function public.my_org_id() to authenticated;
grant execute on function public.my_role() to authenticated;

-- 2. Team logo storage: require the acting user to be a member of the org that owns the
-- team encoded in the first path segment (<team_id>/logo-...). Legacy null-org teams stay
-- writable by signed-in coaches, matching the app's existing shared-team visibility rules.
drop policy if exists "team logos coach upload" on storage.objects;
drop policy if exists "team logos coach update" on storage.objects;
drop policy if exists "team logos coach delete" on storage.objects;

create policy "team logos coach upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'team-logos'
  and exists (
    select 1 from public.teams t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (t.org_id is null or t.org_id = public.my_org_id())
  )
);

create policy "team logos coach update" on storage.objects
for update to authenticated
using (
  bucket_id = 'team-logos'
  and exists (
    select 1 from public.teams t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (t.org_id is null or t.org_id = public.my_org_id())
  )
)
with check (
  bucket_id = 'team-logos'
  and exists (
    select 1 from public.teams t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (t.org_id is null or t.org_id = public.my_org_id())
  )
);

create policy "team logos coach delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'team-logos'
  and exists (
    select 1 from public.teams t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (t.org_id is null or t.org_id = public.my_org_id())
  )
);