
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null default '2025-26',
  created_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  jersey text not null,
  name text not null,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent text not null,
  game_date date not null default current_date,
  periods integer not null default 4,
  period_minutes integer not null default 8,
  status text not null default 'scheduled',
  team_score integer not null default 0,
  opp_score integer not null default 0,
  quarter integer not null default 1,
  clock_seconds integer not null default 480,
  starting_five jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  quarter integer not null default 1,
  clock_seconds integer not null default 0,
  player_id uuid references public.players(id) on delete set null,
  x double precision,
  y double precision,
  event_type text not null,
  result text,
  points integer not null default 0,
  zone text,
  current_lineup jsonb not null default '[]'::jsonb,
  related_event_id uuid,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.substitutions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  quarter integer not null default 1,
  clock_seconds integer not null default 0,
  player_out uuid references public.players(id) on delete set null,
  player_in uuid references public.players(id) on delete set null,
  lineup_after jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  category text not null default 'Offense',
  attack_basket text not null default 'right',
  is_shared boolean not null default false,
  share_token text unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now()
);
create table public.play_frames (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null references public.plays(id) on delete cascade,
  idx integer not null default 0,
  tokens jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.teams to anon, authenticated;
grant select, insert, update, delete on public.players to anon, authenticated;
grant select, insert, update, delete on public.games to anon, authenticated;
grant select, insert, update, delete on public.game_events to anon, authenticated;
grant select, insert, update, delete on public.substitutions to anon, authenticated;
grant select, insert, update, delete on public.plays to anon, authenticated;
grant select, insert, update, delete on public.play_frames to anon, authenticated;
grant all on public.teams, public.players, public.games, public.game_events, public.substitutions, public.plays, public.play_frames to service_role;

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.substitutions enable row level security;
alter table public.plays enable row level security;
alter table public.play_frames enable row level security;

create policy "open teams" on public.teams for all using (true) with check (true);
create policy "open players" on public.players for all using (true) with check (true);
create policy "open games" on public.games for all using (true) with check (true);
create policy "open game_events" on public.game_events for all using (true) with check (true);
create policy "open substitutions" on public.substitutions for all using (true) with check (true);
create policy "open plays" on public.plays for all using (true) with check (true);
create policy "open play_frames" on public.play_frames for all using (true) with check (true);

insert into public.teams (id, name, season) values ('11111111-1111-1111-1111-111111111111', 'Aliso Niguel', '2025-26');

insert into public.players (id, team_id, jersey, name, position, active) values
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','1','Jordan Reyes','PG',true),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','3','Miles Carter','SG',true),
 ('22222222-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','5','Andre Wallace','C',true),
 ('22222222-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','11','Tyler Nguyen','SF',true),
 ('22222222-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111','20','Chris Delgado','PF',true),
 ('22222222-0000-0000-0000-000000000024','11111111-1111-1111-1111-111111111111','24','Owen Brooks','SF',true),
 ('22222222-0000-0000-0000-000000000032','11111111-1111-1111-1111-111111111111','32','Marcus Hall','C',true),
 ('22222222-0000-0000-0000-000000000033','11111111-1111-1111-1111-111111111111','33','Devin Price','SG',true);

insert into public.games (id, team_id, opponent, periods, period_minutes, status, quarter, clock_seconds, starting_five)
values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Mission Viejo',4,8,'live',1,480,
 '["22222222-0000-0000-0000-000000000001","22222222-0000-0000-0000-000000000003","22222222-0000-0000-0000-000000000011","22222222-0000-0000-0000-000000000020","22222222-0000-0000-0000-000000000032"]'::jsonb);

insert into public.plays (id, team_id, name, category, attack_basket, is_shared)
values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Horns Twist','Offense','right',true);

insert into public.play_frames (play_id, idx, tokens, actions, note) values
('44444444-4444-4444-4444-444444444444',0,
 '[{"id":"p1","label":"1","x":0.5,"y":0.5,"ball":true},{"id":"p2","label":"2","x":0.62,"y":0.12,"ball":false},{"id":"p3","label":"3","x":0.62,"y":0.88,"ball":false},{"id":"p4","label":"4","x":0.72,"y":0.34,"ball":false},{"id":"p5","label":"5","x":0.72,"y":0.66,"ball":false}]'::jsonb,
 '[{"id":"a1","type":"screen","seq":1,"points":[{"x":0.72,"y":0.34},{"x":0.58,"y":0.42}]}]'::jsonb,'Horns set, 4 steps up to screen'),
('44444444-4444-4444-4444-444444444444',1,
 '[{"id":"p1","label":"1","x":0.6,"y":0.36,"ball":true},{"id":"p2","label":"2","x":0.62,"y":0.12,"ball":false},{"id":"p3","label":"3","x":0.62,"y":0.88,"ball":false},{"id":"p4","label":"4","x":0.58,"y":0.42,"ball":false},{"id":"p5","label":"5","x":0.8,"y":0.6,"ball":false}]'::jsonb,
 '[{"id":"a2","type":"dribble","seq":1,"points":[{"x":0.5,"y":0.5},{"x":0.6,"y":0.36}]},{"id":"a3","type":"cut","seq":1,"points":[{"x":0.72,"y":0.66},{"x":0.8,"y":0.6}]}]'::jsonb,'1 uses the screen, 5 dives'),
('44444444-4444-4444-4444-444444444444',2,
 '[{"id":"p1","label":"1","x":0.66,"y":0.3,"ball":false},{"id":"p2","label":"2","x":0.62,"y":0.12,"ball":true},{"id":"p3","label":"3","x":0.62,"y":0.88,"ball":false},{"id":"p4","label":"4","x":0.58,"y":0.42,"ball":false},{"id":"p5","label":"5","x":0.86,"y":0.55,"ball":false}]'::jsonb,
 '[{"id":"a4","type":"pass","seq":1,"points":[{"x":0.6,"y":0.36},{"x":0.62,"y":0.12}]}]'::jsonb,'Kick to the corner for the shot');
