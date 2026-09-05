import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_TEAM_ID, fetchPlayers, fetchTeams } from "@/lib/data";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Roster — CourtFlow Coach" },
      {
        name: "description",
        content: "Manage teams, jersey numbers, positions and active players for the season.",
      },
      { property: "og:title", content: "Roster — CourtFlow Coach" },
      {
        property: "og:description",
        content: "Manage teams, jersey numbers, positions and active players.",
      },
    ],
  }),
  component: RosterPage,
});

function RosterPage() {
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [teamId, setTeamId] = useState<string>(DEMO_TEAM_ID);
  const activeTeam = teams.data?.find((t) => t.id === teamId) ?? teams.data?.[0];
  const currentTeamId = activeTeam?.id ?? DEMO_TEAM_ID;

  const players = useQuery({
    queryKey: ["players", currentTeamId],
    queryFn: () => fetchPlayers(currentTeamId),
  });

  const [jersey, setJersey] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const addPlayer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("players")
        .insert({ team_id: currentTeamId, jersey, name, position: position || null } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setJersey("");
      setName("");
      setPosition("");
      toast.success("Player added");
      qc.invalidateQueries({ queryKey: ["players", currentTeamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Player) => {
      const { error } = await supabase
        .from("players")
        .update({ active: !p.active } as never)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players", currentTeamId] }),
  });

  const removePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players", currentTeamId] }),
  });

  const addTeam = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .insert({ name: newTeam } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (t) => {
      setNewTeam("");
      setTeamId(t.id);
      toast.success("Team created");
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  const inputCls =
    "w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-grape";

  return (
    <AppShell title="Roster & Teams" subtitle={activeTeam ? `Season ${activeTeam.season}` : ""}>
      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-3">
          <Panel className="flex flex-col gap-3">
            <Label>Teams</Label>
            <div className="flex flex-wrap gap-2">
              {teams.data?.map((t) => (
                <BubbleButton
                  key={t.id}
                  size="sm"
                  tone={t.id === currentTeamId ? "grape" : "neutral"}
                  onClick={() => setTeamId(t.id)}
                >
                  {t.name}
                </BubbleButton>
              ))}
            </div>
            <input
              className={inputCls}
              placeholder="New team name"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
            />
            <BubbleButton tone="flame" disabled={!newTeam} onClick={() => addTeam.mutate()}>
              Create Team
            </BubbleButton>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <Label>Add player</Label>
            <input
              className={inputCls}
              placeholder="Jersey #"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Position (optional)"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <BubbleButton
              tone="grape"
              disabled={!jersey || !name}
              onClick={() => addPlayer.mutate()}
            >
              Add To Roster
            </BubbleButton>
          </Panel>
        </div>

        <Panel className="flex flex-col gap-2">
          <Label>{players.data?.length ?? 0} players</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.data?.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2/70 p-2"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-grape/70 bg-grape/25 text-base font-black">
                  {p.jersey}
                </span>
                <span className="flex-1 truncate rounded-xl bg-surface/70 px-3 py-1.5 text-sm font-bold">
                  {p.name}
                </span>
                {p.position ? <Pill tone="muted">{p.position}</Pill> : null}
                <BubbleButton
                  size="sm"
                  tone={p.active ? "flame" : "ghost"}
                  onClick={() => toggleActive.mutate(p)}
                >
                  {p.active ? "Active" : "Inactive"}
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => removePlayer.mutate(p.id)}>
                  ✕
                </BubbleButton>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
