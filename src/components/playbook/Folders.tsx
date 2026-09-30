import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Field, InfoPanel, Label, Panel, Pill, SelectInput, TextInput } from "@/components/Bubbles";
import { PlayThumb } from "@/components/community/PlayThumb";
import {
  createPlaybookFolder,
  deletePlaybookFolder,
  fetchPlaybookFolders,
  fetchPlayFolderMemberships,
  setFolderPlays,
  setPlayFolderMembership,
  updatePlaybookFolder,
  type FolderVisibility,
  type TeamPlaybookFolder,
} from "@/lib/data";
import { normalizeCategory, type Play, type Team } from "@/lib/types";
import { cn } from "@/lib/utils";

export function useFolderInvalidate(teamId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["playbook-folders", teamId] });
    void qc.invalidateQueries({ queryKey: ["play-folder-memberships", teamId] });
  };
}

export function VisibilityPill({ visibility }: { visibility: string }) {
  return visibility === "coaches_only" ? <Pill tone="flame">Coaches only</Pill> : <Pill tone="success">Shared with team</Pill>;
}

/** Minimal create form: name, optional description, visibility. */
export function CreateFolderForm({ teamId, onDone }: { teamId: string; onDone: (f?: TeamPlaybookFolder) => void }) {
  const invalidate = useFolderInvalidate(teamId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<FolderVisibility>("team");
  const create = useMutation({
    mutationFn: () => createPlaybookFolder(teamId, name, { description, visibility }),
    onSuccess: (f) => { invalidate(); toast.success(`Folder “${f.name}” created`); onDone(f); },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "A folder with that name already exists" : e.message),
  });
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-grape/50 bg-grape/10 p-3">
      <Field label="Folder name">
        <TextInput autoFocus placeholder="e.g. Dana Hills, End of Game, Zone BLOBs" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description (optional)">
        <TextInput placeholder="What these plays are for" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Label>Visibility</Label>
        <BubbleButton size="sm" tone={visibility === "team" ? "grape" : "neutral"} onClick={() => setVisibility("team")}>Share with Team</BubbleButton>
        <BubbleButton size="sm" tone={visibility === "coaches_only" ? "grape" : "neutral"} onClick={() => setVisibility("coaches_only")}>Coaches Only</BubbleButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <BubbleButton tone="flame" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Creating…" : "Create Folder"}
        </BubbleButton>
        <BubbleButton tone="ghost" onClick={() => onDone()}>Cancel</BubbleButton>
      </div>
    </div>
  );
}

export function FolderCard({
  folder, count, active, canManage, onOpen,
}: { folder: TeamPlaybookFolder; count: number; active: boolean; canManage: boolean; onOpen: () => void }) {
  const invalidate = useFolderInvalidate(folder.team_id);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updatePlaybookFolder>[1]) => updatePlaybookFolder(folder.id, patch),
    onSuccess: () => { invalidate(); setRenaming(false); setMenu(false); toast.success("Folder updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deletePlaybookFolder(folder.id),
    onSuccess: () => { invalidate(); toast.success("Folder deleted — plays stay in the team Playbook"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Panel className={cn("flex flex-col gap-2", active && "border-flame/70 bg-flame/10")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="truncate rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-lg font-black text-foreground">📁 {folder.name}</span>
        {canManage ? (
          <BubbleButton size="sm" tone={menu ? "grape" : "neutral"} aria-label={`Folder actions for ${folder.name}`} onClick={() => setMenu((m) => !m)}>•••</BubbleButton>
        ) : null}
      </div>
      {folder.description ? <InfoPanel className="py-2 text-xs">{folder.description}</InfoPanel> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={count ? "flame" : "muted"}>{count} {count === 1 ? "play" : "plays"}</Pill>
        <VisibilityPill visibility={folder.visibility} />
      </div>
      <BubbleButton tone={active ? "flame" : "grape"} onClick={onOpen}>{active ? "Folder open" : "Open Folder"}</BubbleButton>
      {menu ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface-2/70 p-2">
          <BubbleButton size="sm" tone="neutral" onClick={() => setRenaming(true)}>Rename</BubbleButton>
          <BubbleButton size="sm" tone="neutral" disabled={update.isPending} onClick={() => update.mutate({ visibility: folder.visibility === "coaches_only" ? "team" : "coaches_only" })}>
            {folder.visibility === "coaches_only" ? "Share with Team" : "Make Coaches Only"}
          </BubbleButton>
          <BubbleButton size="sm" tone="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete folder “${folder.name}”? Plays are not deleted and stay in the team Playbook.`)) remove.mutate(); }}>Delete</BubbleButton>
        </div>
      ) : null}
      {renaming ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
          <TextInput className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
          <BubbleButton size="sm" tone="grape" disabled={!name.trim()} onClick={() => update.mutate({ name: name.trim() })}>Save</BubbleButton>
          <BubbleButton size="sm" tone="ghost" onClick={() => setRenaming(false)}>Cancel</BubbleButton>
        </div>
      ) : null}
    </Panel>
  );
}

/** Bulk picker: current team's plays with thumbnails; one Save. */
export function AddPlaysPicker({
  folder, teamPlays, memberIds, onDone,
}: { folder: TeamPlaybookFolder; teamPlays: Play[]; memberIds: string[]; onDone: () => void }) {
  const invalidate = useFolderInvalidate(folder.team_id);
  const [picked, setPicked] = useState<string[]>(memberIds);
  const [q, setQ] = useState("");
  const save = useMutation({
    mutationFn: () => setFolderPlays(folder.id, folder.team_id, picked),
    onSuccess: () => { invalidate(); toast.success(`“${folder.name}” updated`); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const list = teamPlays.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Panel className="flex flex-col gap-3 border-grape/60">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Add plays to {folder.name}</Label>
        <Pill tone="grape">{picked.length} selected</Pill>
        <TextInput className="max-w-xs" placeholder="Search plays" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => {
          const on = picked.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
              className={cn("flex flex-col gap-1 rounded-2xl border p-2 text-left transition", on ? "border-grape bg-grape/20" : "border-border bg-surface/70")}
            >
              <PlayThumb playId={p.id} attackBasket={p.attack_basket} category={p.category} authenticated />
              <span className="flex items-center gap-1 rounded-xl bg-background/50 px-2 py-1 text-sm font-black text-foreground">
                <span>{on ? "☑" : "☐"}</span><span className="truncate">{p.name}</span>
              </span>
              <Pill tone="muted" className="self-start">{normalizeCategory(p.category)}</Pill>
            </button>
          );
        })}
        {!list.length ? <InfoPanel>No plays in this team’s Playbook yet</InfoPanel> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <BubbleButton tone="flame" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save"}</BubbleButton>
        <BubbleButton tone="ghost" onClick={onDone}>Cancel</BubbleButton>
      </div>
    </Panel>
  );
}

/** Per-play checklist across a team's folders; multiple can be checked. */
export function AddToFolderPanel({
  playId, teams, defaultTeamId, onClose,
}: { playId: string; teams: Team[]; defaultTeamId: string | null; onClose: () => void }) {
  const [teamId, setTeamId] = useState(defaultTeamId && teams.some((t) => t.id === defaultTeamId) ? defaultTeamId : (teams[0]?.id ?? ""));
  const invalidate = useFolderInvalidate(teamId);
  const folders = useQuery({ queryKey: ["playbook-folders", teamId], queryFn: () => fetchPlaybookFolders(teamId), enabled: !!teamId });
  const memberships = useQuery({ queryKey: ["play-folder-memberships", teamId], queryFn: () => fetchPlayFolderMemberships(teamId), enabled: !!teamId });
  const [creating, setCreating] = useState(false);
  const toggle = useMutation({
    mutationFn: ({ folderId, included }: { folderId: string; included: boolean }) => setPlayFolderMembership(playId, teamId, folderId, included),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!teams.length) {
    return <InfoPanel>Add this play to one of your teams first — folders belong to a team.</InfoPanel>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-grape/50 bg-grape/10 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Add to Folder</Label>
        {teams.length > 1 ? (
          <SelectInput className="max-w-[12rem]" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </SelectInput>
        ) : <Pill tone="muted">{teams[0]!.name}</Pill>}
      </div>
      <div className="flex flex-col gap-1">
        {(folders.data ?? []).map((f) => {
          const checked = !!memberships.data?.some((m) => m.folder_id === f.id && m.play_id === playId);
          return (
            <button
              key={f.id}
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ folderId: f.id, included: !checked })}
              className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold", checked ? "border-grape bg-grape/20 text-foreground" : "border-border bg-surface/70 text-foreground")}
            >
              <span>{checked ? "☑" : "☐"}</span><span className="truncate">{f.name}</span>
              {f.visibility === "coaches_only" ? <Pill tone="flame" className="ml-auto px-2 py-0 text-[10px]">Coaches</Pill> : null}
            </button>
          );
        })}
        {folders.data && !folders.data.length ? <InfoPanel className="py-2 text-xs">No folders for this team yet</InfoPanel> : null}
      </div>
      {creating ? (
        <CreateFolderForm teamId={teamId} onDone={(f) => { setCreating(false); if (f) toggle.mutate({ folderId: f.id, included: true }); }} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <BubbleButton size="sm" tone="flame" onClick={() => setCreating(true)}>+ New Folder</BubbleButton>
          <BubbleButton size="sm" tone="ghost" onClick={onClose}>Done</BubbleButton>
        </div>
      )}
    </div>
  );
}
