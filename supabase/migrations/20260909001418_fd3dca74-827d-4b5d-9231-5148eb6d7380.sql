CREATE OR REPLACE FUNCTION public.my_team_role(_team uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select m.role::text from public.team_members m
      where m.team_id = _team and m.user_id = auth.uid() and m.active
      order by case m.role
        when 'head_coach' then 0
        when 'assistant_coach' then 1
        when 'parent' then 2
        else 3 end
      limit 1),
    case when public.is_team_coach(_team) then 'head_coach' else null end
  )
$function$;