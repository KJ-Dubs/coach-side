
-- ============ roles & membership ============
alter table public.teams
  add column if not exists allow_player_posting boolean not null default true,
  add column if not exists require_ack_default boolean not null default false;

create type public.team_role as enum ('head_coach','assistant_coach','player','parent');

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role public.team_role not null default 'player',
  player_id uuid references public.players(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invite_type text not null check (invite_type in ('player','parent')),
  token text not null unique default encode(extensions.gen_random_bytes(12),'hex'),
  active boolean not null default true,
  created_by uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team_invites to authenticated;
grant all on public.team_invites to service_role;
alter table public.team_invites enable row level security;

-- ============ helper functions ============
create or replace function public.is_team_coach(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active
      and m.role in ('head_coach','assistant_coach')
  ) or exists (
    select 1 from public.teams t
    where t.id = _team
      and (
        t.org_id = public.my_org_id()
        or (t.org_id is null and not exists (
              select 1 from public.team_members m2
              where m2.team_id = _team and m2.user_id = auth.uid()
           ))
      )
  )
$$;

create or replace function public.is_team_head_coach(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = _team and m.user_id = auth.uid() and m.active and m.role = 'head_coach'
  ) or (public.is_team_coach(_team) and coalesce(public.is_head_coach(), false))
  or exists (
    select 1 from public.teams t
    where t.id = _team and t.org_id is null
      and not exists (select 1 from public.team_members m2 where m2.team_id = _team and m2.user_id = auth.uid())
  )
$$;

create or replace function public.my_team_role(_team uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.role::text from public.team_members m
      where m.team_id = _team and m.user_id = auth.uid() and m.active limit 1),
    case when public.is_team_coach(_team) then 'head_coach' else null end
  )
$$;

create or replace function public.is_team_member(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_team_role(_team) is not null
$$;

create or replace function public.is_team_staff_or_player(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_team_role(_team) in ('head_coach','assistant_coach','player'), false)
$$;

revoke all on function public.is_team_coach(uuid) from public, anon;
revoke all on function public.is_team_head_coach(uuid) from public, anon;
revoke all on function public.my_team_role(uuid) from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;
revoke all on function public.is_team_staff_or_player(uuid) from public, anon;
grant execute on function public.is_team_coach(uuid) to authenticated;
grant execute on function public.is_team_head_coach(uuid) to authenticated;
grant execute on function public.my_team_role(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_staff_or_player(uuid) to authenticated;

-- membership policies
create policy "members read team members" on public.team_members
  for select to authenticated using (public.is_team_member(team_id) or user_id = auth.uid());
create policy "coach manages team members" on public.team_members
  for insert to authenticated with check (public.is_team_coach(team_id));
create policy "coach updates team members" on public.team_members
  for update to authenticated using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "coach removes team members" on public.team_members
  for delete to authenticated using (public.is_team_coach(team_id) or user_id = auth.uid());

create policy "coach reads invites" on public.team_invites
  for select to authenticated using (public.is_team_coach(team_id));
create policy "head coach creates invites" on public.team_invites
  for insert to authenticated with check (public.is_team_head_coach(team_id) and created_by = auth.uid());
create policy "head coach updates invites" on public.team_invites
  for update to authenticated using (public.is_team_head_coach(team_id)) with check (public.is_team_head_coach(team_id));
create policy "head coach deletes invites" on public.team_invites
  for delete to authenticated using (public.is_team_head_coach(team_id));

-- ============ invite RPCs ============
create or replace function public.get_team_invite(_token text)
returns table(team_id uuid, team_name text, season text, invite_type text, status text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.season, i.invite_type,
         case when not i.active then 'revoked'
              when i.expires_at is not null and i.expires_at < now() then 'expired'
              else 'active' end
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = _token
  limit 1
$$;
revoke all on function public.get_team_invite(text) from public, anon;
grant execute on function public.get_team_invite(text) to authenticated;

create or replace function public.invite_roster(_token text)
returns table(id uuid, jersey text, name text, taken boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.jersey, p.name,
         exists (select 1 from public.team_members m where m.player_id = p.id and m.active)
  from public.team_invites i
  join public.players p on p.team_id = i.team_id and p.active
  where i.token = _token and i.active and (i.expires_at is null or i.expires_at > now())
  order by length(p.jersey), p.jersey
$$;
revoke all on function public.invite_roster(text) from public, anon;
grant execute on function public.invite_roster(text) to authenticated;

create or replace function public.accept_team_invite(_token text, _player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.team_invites%rowtype;
        uid uuid := auth.uid();
        new_role public.team_role;
begin
  if uid is null then raise exception 'Sign in to join this team'; end if;
  select * into inv from public.team_invites where token = _token;
  if not found then raise exception 'This invite link is not valid'; end if;
  if not inv.active then raise exception 'This invite link has been turned off'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'This invite link has expired'; end if;

  new_role := case when inv.invite_type = 'parent' then 'parent'::public.team_role else 'player'::public.team_role end;

  if new_role = 'player' and _player_id is not null then
    if not exists (select 1 from public.players p where p.id = _player_id and p.team_id = inv.team_id) then
      raise exception 'That player is not on this team';
    end if;
    if exists (select 1 from public.team_members m where m.player_id = _player_id and m.active and m.user_id <> uid) then
      raise exception 'That player has already been claimed';
    end if;
  end if;

  insert into public.team_members (team_id, user_id, role, player_id, active)
  values (inv.team_id, uid, new_role, case when new_role = 'player' then _player_id else null end, true)
  on conflict (team_id, user_id) do update
    set role = excluded.role,
        player_id = coalesce(excluded.player_id, public.team_members.player_id),
        active = true,
        updated_at = now();

  return jsonb_build_object('team_id', inv.team_id, 'role', new_role::text);
end;
$$;
revoke all on function public.accept_team_invite(text, uuid) from public, anon;
grant execute on function public.accept_team_invite(text, uuid) to authenticated;

-- ============ conversations ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null check (type in ('team','staff','direct')),
  title text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversations_team_singleton on public.conversations (team_id, type) where type in ('team','staff');
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);
grant select, insert, update, delete on public.conversation_members to authenticated;
grant all on public.conversation_members to service_role;
alter table public.conversation_members enable row level security;

create or replace function public.can_read_conversation(_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = _conv and (
      (c.type = 'team'   and public.is_team_staff_or_player(c.team_id))
      or (c.type = 'staff'  and public.is_team_coach(c.team_id))
      or (c.type = 'direct' and exists (
            select 1 from public.conversation_members cm
            where cm.conversation_id = c.id and cm.user_id = auth.uid()))
    )
  )
$$;

create or replace function public.can_post_conversation(_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c join public.teams t on t.id = c.team_id
    where c.id = _conv and (
      (c.type = 'team' and (
          public.is_team_coach(c.team_id)
          or (coalesce(t.allow_player_posting, true) and public.my_team_role(c.team_id) = 'player')))
      or (c.type = 'staff' and public.is_team_coach(c.team_id))
      or (c.type = 'direct' and exists (
            select 1 from public.conversation_members cm
            where cm.conversation_id = c.id and cm.user_id = auth.uid()))
    )
  )
$$;
revoke all on function public.can_read_conversation(uuid) from public, anon;
revoke all on function public.can_post_conversation(uuid) from public, anon;
grant execute on function public.can_read_conversation(uuid) to authenticated;
grant execute on function public.can_post_conversation(uuid) to authenticated;

create policy "read conversations" on public.conversations
  for select to authenticated using (public.can_read_conversation(id));
create policy "coach creates conversations" on public.conversations
  for insert to authenticated with check (public.is_team_coach(team_id) and created_by = auth.uid());
create policy "coach updates conversations" on public.conversations
  for update to authenticated using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));

create policy "read conversation members" on public.conversation_members
  for select to authenticated using (public.can_read_conversation(conversation_id));
create policy "coach or self joins conversation" on public.conversation_members
  for insert to authenticated with check (
    user_id = auth.uid() or exists (
      select 1 from public.conversations c where c.id = conversation_id and public.is_team_coach(c.team_id))
  );
create policy "self updates conversation member" on public.conversation_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "coach or self removes conversation member" on public.conversation_members
  for delete to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.conversations c where c.id = conversation_id and public.is_team_coach(c.team_id))
  );

-- ============ messages ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_created on public.messages (conversation_id, created_at);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create policy "read messages" on public.messages
  for select to authenticated using (public.can_read_conversation(conversation_id));
create policy "write messages" on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.can_post_conversation(conversation_id));
create policy "edit own messages" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy "delete own messages" on public.messages
  for delete to authenticated using (
    sender_id = auth.uid() or exists (
      select 1 from public.conversations c where c.id = conversation_id and public.is_team_coach(c.team_id))
  );

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  attachment_type text not null check (attachment_type in
    ('play','event','game','stat','resource','full_game_video','video_clip','drill_video','coach_video','game_timestamp_clip')),
  related_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.message_attachments to authenticated;
grant all on public.message_attachments to service_role;
alter table public.message_attachments enable row level security;
create policy "read message attachments" on public.message_attachments
  for select to authenticated using (exists (
    select 1 from public.messages m where m.id = message_id and public.can_read_conversation(m.conversation_id)));
create policy "write message attachments" on public.message_attachments
  for insert to authenticated with check (exists (
    select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));
create policy "delete message attachments" on public.message_attachments
  for delete to authenticated using (exists (
    select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);
grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
alter table public.message_reactions enable row level security;
create policy "read reactions" on public.message_reactions
  for select to authenticated using (exists (
    select 1 from public.messages m where m.id = message_id and public.can_read_conversation(m.conversation_id)));
create policy "own reactions" on public.message_reactions
  for insert to authenticated with check (user_id = auth.uid() and exists (
    select 1 from public.messages m where m.id = message_id and public.can_read_conversation(m.conversation_id)));
create policy "remove own reactions" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- ============ announcements ============
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid,
  audience text not null default 'everyone' check (audience in ('players','parents','coaches','everyone')),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  require_acknowledgment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_team_created on public.announcements (team_id, created_at desc);
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;

create policy "read announcements for my audience" on public.announcements
  for select to authenticated using (
    public.is_team_member(team_id) and (
      audience = 'everyone'
      or (audience = 'coaches' and public.is_team_coach(team_id))
      or (audience = 'players' and public.my_team_role(team_id) in ('player','head_coach','assistant_coach'))
      or (audience = 'parents' and public.my_team_role(team_id) in ('parent','head_coach','assistant_coach'))
    )
  );
create policy "coach writes announcements" on public.announcements
  for insert to authenticated with check (public.is_team_coach(team_id) and created_by = auth.uid());
create policy "coach updates announcements" on public.announcements
  for update to authenticated using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "coach deletes announcements" on public.announcements
  for delete to authenticated using (public.is_team_coach(team_id));

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  attachment_type text not null check (attachment_type in
    ('play','event','game','stat','resource','full_game_video','video_clip','drill_video','coach_video','game_timestamp_clip')),
  related_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.announcement_attachments to authenticated;
grant all on public.announcement_attachments to service_role;
alter table public.announcement_attachments enable row level security;
create policy "read announcement attachments" on public.announcement_attachments
  for select to authenticated using (exists (
    select 1 from public.announcements a where a.id = announcement_id and public.is_team_member(a.team_id)));
create policy "coach writes announcement attachments" on public.announcement_attachments
  for all to authenticated using (exists (
    select 1 from public.announcements a where a.id = announcement_id and public.is_team_coach(a.team_id)))
  with check (exists (
    select 1 from public.announcements a where a.id = announcement_id and public.is_team_coach(a.team_id)));

create table public.announcement_receipts (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null,
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);
grant select, insert, update, delete on public.announcement_receipts to authenticated;
grant all on public.announcement_receipts to service_role;
alter table public.announcement_receipts enable row level security;
create policy "read receipts" on public.announcement_receipts
  for select to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.announcements a where a.id = announcement_id and public.is_team_coach(a.team_id)));
create policy "own receipt insert" on public.announcement_receipts
  for insert to authenticated with check (user_id = auth.uid());
create policy "own receipt update" on public.announcement_receipts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ assignments ============
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid,
  assignment_type text not null default 'task' check (assignment_type in
    ('play','event','resource','task','video_review')),
  title text not null,
  instructions text,
  due_at timestamptz,
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "team reads assignments" on public.assignments
  for select to authenticated using (public.is_team_staff_or_player(team_id));
create policy "coach writes assignments" on public.assignments
  for insert to authenticated with check (public.is_team_coach(team_id) and created_by = auth.uid());
create policy "coach updates assignments" on public.assignments
  for update to authenticated using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "coach deletes assignments" on public.assignments
  for delete to authenticated using (public.is_team_coach(team_id));

create table public.assignment_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid,
  player_id uuid references public.players(id) on delete cascade,
  status text not null default 'not_viewed' check (status in ('not_viewed','viewed','acknowledged','completed')),
  viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignment_targets_assignment on public.assignment_targets (assignment_id);
grant select, insert, update, delete on public.assignment_targets to authenticated;
grant all on public.assignment_targets to service_role;
alter table public.assignment_targets enable row level security;
create policy "read assignment targets" on public.assignment_targets
  for select to authenticated using (exists (
    select 1 from public.assignments a where a.id = assignment_id and public.is_team_staff_or_player(a.team_id)));
create policy "coach writes assignment targets" on public.assignment_targets
  for insert to authenticated with check (exists (
    select 1 from public.assignments a where a.id = assignment_id and public.is_team_coach(a.team_id)));
create policy "update assignment targets" on public.assignment_targets
  for update to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.active and m.player_id = assignment_targets.player_id)
    or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_team_coach(a.team_id)))
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.active and m.player_id = assignment_targets.player_id)
    or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_team_coach(a.team_id)));
create policy "coach deletes assignment targets" on public.assignment_targets
  for delete to authenticated using (exists (
    select 1 from public.assignments a where a.id = assignment_id and public.is_team_coach(a.team_id)));

-- ============ resources ============
create table public.team_resources (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid,
  title text not null,
  body text,
  url text,
  category text not null default 'document',
  audience text not null default 'everyone' check (audience in ('players','parents','coaches','everyone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team_resources to authenticated;
grant all on public.team_resources to service_role;
alter table public.team_resources enable row level security;
create policy "team reads resources" on public.team_resources
  for select to authenticated using (
    public.is_team_member(team_id) and (
      audience = 'everyone'
      or (audience = 'coaches' and public.is_team_coach(team_id))
      or (audience = 'players' and public.my_team_role(team_id) in ('player','head_coach','assistant_coach'))
      or (audience = 'parents' and public.my_team_role(team_id) in ('parent','head_coach','assistant_coach'))));
create policy "coach manages resources" on public.team_resources
  for all to authenticated using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));

-- ============ updated_at triggers ============
create trigger update_team_members_updated_at before update on public.team_members
  for each row execute function public.update_updated_at_column();
create trigger update_team_invites_updated_at before update on public.team_invites
  for each row execute function public.update_updated_at_column();
create trigger update_conversations_updated_at before update on public.conversations
  for each row execute function public.update_updated_at_column();
create trigger update_conversation_members_updated_at before update on public.conversation_members
  for each row execute function public.update_updated_at_column();
create trigger update_announcements_updated_at before update on public.announcements
  for each row execute function public.update_updated_at_column();
create trigger update_announcement_receipts_updated_at before update on public.announcement_receipts
  for each row execute function public.update_updated_at_column();
create trigger update_assignments_updated_at before update on public.assignments
  for each row execute function public.update_updated_at_column();
create trigger update_assignment_targets_updated_at before update on public.assignment_targets
  for each row execute function public.update_updated_at_column();
create trigger update_team_resources_updated_at before update on public.team_resources
  for each row execute function public.update_updated_at_column();
