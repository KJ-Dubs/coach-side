import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  BubbleButton,
  EmptyState,
  Field,
  Label,
  Note,
  Panel,
  Pill,
  SelectInput,
  StatTile,
  TextInput,
} from "@/components/Bubbles";
import {
  createPlayer,
  createTeam,
  fetchAllPlayers,
  fetchSeasonBundle,
  fetchTeams,
  updatePlayer,
} from "@/lib/data";
import { aggregatePlayers, fmtMinutes } from "@/lib/stats";
import type { Player } from "@/lib/types";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roster")({
  head: () => ({
    meta: [
      { title: "Rosters — CourtSide Coach" },
      {
        name: "description",
        content: "Player directory across every team: jersey, games, points, minutes and status.",
      },
      { property: "og:title", content: "Rosters — CourtSide Coach" },
      { property: "og:description", content: "Player directory and roster management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RosterPage,
});

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"];

function RosterPage() {
  const qc = useQueryClient();
  const me = useMe();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const players = useQuery({ queryKey: ["players", "all"], queryFn: fetchAllPlayers });
  const bundle = useQuery({
    queryKey: ["season-bundle", "final"],
    queryFn: () => fetchSeasonBundle({ finalOnly: true }),
  });

  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState<"player" | "team" | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const lines = useMemo(
    () =>
      bundle.data
        ? aggregatePlayers(bundle.data.games, bundle.data.events, bundle.data.subs)
        : new Map(),
    [bundle.data],
  );
  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? "Team";

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (players.data ?? []).filter(
      (p) =>
        (teamFilter === "ALL" || p.team_id === teamFilter) &&
        (showInactive || p.active) &&
        (!q || p.name.toLowerCase().includes(q) || p.jersey.includes(q)),
    );
  }, [players.data, teamFilter, showInactive, search]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["players"] });
    void qc.invalidateQueries({ queryKey: ["teams"] });
  };

  /* ---- add team ---- */
  const [teamNameInput, setTeamNameInput] = useState("");
  const [seasonInput, setSeasonInput] = useState("2025-26");
  const addTeam = useMutation({
    mutationFn: () =>
      createTeam({
        name: teamNameInput.trim(),
        season: seasonInput.trim() || "2025-26",
        orgId: me.profile?.org_id ?? null,
      }),
    onSuccess: (t) => {
      toast.success(`${t.name} added`);
      setTeamNameInput("");
      setOpenForm(null);
      setTeamFilter(t.id);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---- add player ---- */
  const [pTeam, setPTeam] = useState<string>("");
  const [pJersey, setPJersey] = useState("");
  const [pName, setPName] = useState("");
  const [pPos, setPPos] = useState("");
  const addPlayer = useMutation({
    mutationFn: () =>
      createPlayer({
        team_id: pTeam || (teamFilter !== "ALL" ? teamFilter : teams.data?.[0]?.id ?? ""),
        jersey: pJersey.trim(),
        name: pName.trim(),
        position: pPos || null,
      }),
    onSuccess: (p) => {
      toast.success(`#${p.jersey} ${p.name} added`);
      setPJersey("");
      setPName("");
      setPPos("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof updatePlayer>[1] }) =>
      updatePlayer(v.id, v.patch),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCount = (players.data ?? []).filter((p) => p.active).length;

  return (
    <AppShell
      title="Rosters"
      subtitle="Player directory — tap a player for their season stats"
      actions={
        <>
          <BubbleButton
            tone={openForm === "player" ? "grape" : "flame"}
            onClick={() => {
              setOpenForm(openForm === "player" ? null : "player");
              if (teamFilter !== "ALL") setPTeam(teamFilter);
            }}
          >
            + Player
          </BubbleButton>
          <BubbleButton
            tone={openForm === "team" ? "grape" : "neutral"}
            onClick={() => setOpenForm(openForm === "team" ? null : "team")}
          >
            + Team
          </BubbleButton>
        </>
      }
    >
      {openForm === "team" ? (
        <Panel className="mb-3 flex flex-col gap-3 border-grape/50">
          <div className="flex items-center gap-2">
            <Pill tone="grape">New team</Pill>
            <Label>Teams share your program's coaches and plays</Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Team name">
              <TextInput
                placeholder="Aliso Niguel JV"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
              />
            </Field>
            <Field label="Season">
              <TextInput value={seasonInput} onChange={(e) => setSeasonInput(e.target.value)} />
            </Field>
            <div className="flex items-end gap-2">
              <BubbleButton
                tone="grape"
                disabled={!teamNameInput.trim() || addTeam.isPending}
                onClick={() => addTeam.mutate()}
              >
                Save team
              </BubbleButton>
              <BubbleButton tone="ghost" onClick={() => setOpenForm(null)}>
                Cancel
              </BubbleButton>
            </div>
          </div>
        </Panel>
      ) : null}

      {openForm === "player" ? (
        <Panel className="mb-3 flex flex-col gap-3 border-flame/50">
          <div className="flex items-center gap-2">
            <Pill tone="flame">New player</Pill>
          </div>
          {teams.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Team">
                <SelectInput
                  value={pTeam || (teamFilter !== "ALL" ? teamFilter : "")}
                  onChange={(e) => setPTeam(e.target.value)}
                >
                  <option value="" disabled>
                    Choose team
                  </option>
                  {teams.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Jersey #">
                <TextInput
                  inputMode="numeric"
                  placeholder="24"
                  value={pJersey}
                  onChange={(e) => setPJersey(e.target.value)}
                />
              </Field>
              <Field label="Name">
                <TextInput
                  placeholder="Player name"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                />
              </Field>
              <Field label="Position">
                <SelectInput value={pPos} onChange={(e) => setPPos(e.target.value)}>
                  <option value="">—</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="flex items-end gap-2">
                <BubbleButton
                  tone="flame"
                  disabled={
                    !pJersey.trim() ||
                    !pName.trim() ||
                    !(pTeam || (teamFilter !== "ALL" ? teamFilter : "")) ||
                    addPlayer.isPending
                  }
                  onClick={() => addPlayer.mutate()}
                >
                  Save player
                </BubbleButton>
                <BubbleButton tone="ghost" onClick={() => setOpenForm(null)}>
                  Done
                </BubbleButton>
              </div>
            </div>
          ) : (
            <Note tone="flame">Add a team first, then players.</Note>
          )}
        </Panel>
      ) : null}

      <Panel className="mb-3 flex flex-wrap items-center gap-2">
        <Label>Team</Label>
        <BubbleButton
          size="sm"
          tone={teamFilter === "ALL" ? "grape" : "neutral"}
          onClick={() => setTeamFilter("ALL")}
        >
          All
        </BubbleButton>
        {teams.data?.map((t) => (
          <BubbleButton
            key={t.id}
            size="sm"
            tone={teamFilter === t.id ? "grape" : "neutral"}
            onClick={() => setTeamFilter(t.id)}
          >
            {t.name}
            <Pill tone="muted">{(players.data ?? []).filter((p) => p.team_id === t.id && p.active).length}</Pill>
          </BubbleButton>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TextInput
            placeholder="Search name or #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44"
          />
          <BubbleButton
            size="sm"
            tone={showInactive ? "flame" : "ghost"}
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Showing inactive" : "Show inactive"}
          </BubbleButton>
        </div>
      </Panel>

      <Panel className="mb-3 grid grid-cols-3 gap-2">
        <StatTile label="Teams" value={teams.data?.length ?? "—"} tone="grape" />
        <StatTile label="Active players" value={activeCount} />
        <StatTile label="Saved games" value={bundle.data?.games.length ?? "—"} tone="flame" />
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {players.isLoading ? <EmptyState>Loading players…</EmptyState> : null}
        {!players.isLoading && list.length === 0 ? (
          <EmptyState className="sm:col-span-2 xl:col-span-3">No players match</EmptyState>
        ) : null}
        {list.map((p) => {
          const line = lines.get(p.id);
          const isEditing = editing === p.id;
          return (
            <Panel
              key={p.id}
              className={cn(
                "flex flex-col gap-2 p-3",
                !p.active && "opacity-70",
                isEditing && "border-grape/60",
              )}
            >
              <div className="flex items-center gap-2">
                <Link
                  to="/stats/players"
                  search={{ player: p.id, team: p.team_id }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-grape/60 bg-grape/25 text-lg font-black text-foreground">
                    {p.jersey}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate rounded-xl border border-border bg-surface-2/80 px-2.5 py-1 text-sm font-black text-foreground">
                      {p.name}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Pill tone="muted">{teamName(p.team_id)}</Pill>
                      {p.position ? <Pill tone="muted">{p.position}</Pill> : null}
                      <Pill tone={p.active ? "success" : "danger"}>
                        {p.active ? "Active" : "Inactive"}
                      </Pill>
                    </span>
                  </span>
                </Link>
                <BubbleButton
                  size="sm"
                  tone={isEditing ? "grape" : "ghost"}
                  onClick={() => setEditing(isEditing ? null : p.id)}
                >
                  {isEditing ? "Close" : "Edit"}
                </BubbleButton>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <StatTile label="Games" value={line?.games ?? 0} />
                <StatTile label="Points" value={line?.pts ?? 0} tone="flame" />
                <StatTile label="Minutes" value={line ? fmtMinutes(line.seconds) : "0:00"} />
              </div>
              {isEditing ? <PlayerEditor player={p} teams={teams.data ?? []} onSave={(pt) => patch.mutate({ id: p.id, patch: pt })} /> : null}
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}

function PlayerEditor({
  player: p,
  teams,
  onSave,
}: {
  player: Player;
  teams: { id: string; name: string }[];
  onSave: (patch: Parameters<typeof updatePlayer>[1]) => void;
}) {
  const [jersey, setJersey] = useState(p.jersey);
  const [name, setName] = useState(p.name);
  const [position, setPosition] = useState(p.position ?? "");
  const [teamId, setTeamId] = useState(p.team_id);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-surface-2/50 p-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jersey #">
          <TextInput value={jersey} onChange={(e) => setJersey(e.target.value)} />
        </Field>
        <Field label="Position">
          <SelectInput value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">—</option>
            {POSITIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Team">
        <SelectInput value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="flex flex-wrap gap-2">
        <BubbleButton
          size="sm"
          tone="grape"
          disabled={!jersey.trim() || !name.trim()}
          onClick={() =>
            onSave({
              jersey: jersey.trim(),
              name: name.trim(),
              position: position || null,
              team_id: teamId,
            })
          }
        >
          Save changes
        </BubbleButton>
        <BubbleButton
          size="sm"
          tone={p.active ? "danger" : "flame"}
          onClick={() => onSave({ active: !p.active })}
        >
          {p.active ? "Archive (inactive)" : "Reactivate"}
        </BubbleButton>
      </div>
    </div>
  );
}
