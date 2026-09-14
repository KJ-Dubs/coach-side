-- 1) Coach invite acceptance must verify the signed-in user's email matches the invited email.
CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare inv public.coach_invites%rowtype;
        uid uuid := auth.uid();
        verified_email text := public.my_verified_email();
begin
  if uid is null then
    raise exception 'Sign in to accept an invitation';
  end if;
  select * into inv from public.coach_invites where token = _token;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'Invitation already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'Invitation expired';
  end if;
  if verified_email is null or lower(verified_email) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  delete from public.org_members where user_id = uid and org_id <> inv.org_id;
  insert into public.org_members (org_id, user_id, role)
  values (inv.org_id, uid, inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.profiles set org_id = inv.org_id where id = uid;
  if not found then
    insert into public.profiles (id, org_id) values (uid, inv.org_id);
  end if;

  update public.coach_invites set accepted_by = uid, accepted_at = now() where id = inv.id;
  return jsonb_build_object('org_id', inv.org_id, 'role', inv.role, 'team_id', inv.team_id);
end;
$function$;

-- 2) Team member updates: head coach required for coach-role rows; no self role change.
DROP POLICY IF EXISTS "coach updates team members" ON public.team_members;
CREATE POLICY "coach updates team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_team_coach(team_id) OR user_id = auth.uid())
WITH CHECK (
  -- Nobody can change their own role
  (user_id <> auth.uid() OR role = (SELECT m.role FROM public.team_members m WHERE m.id = team_members.id))
  AND (
    -- Player/parent rows: any coach of the team
    (role IN ('player'::public.team_role, 'parent'::public.team_role) AND is_team_coach(team_id))
    OR
    -- Coach-role rows: only the head coach
    (role IN ('head_coach'::public.team_role, 'assistant_coach'::public.team_role) AND is_team_head_coach(team_id))
  )
);