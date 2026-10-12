import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton, Heading, Panel } from "@/components/Bubbles";
import { TeamColorFields } from "@/components/TeamColorFields";
import { normalizeHex } from "@/lib/teamTheme";
import { updateTeam, uploadTeamLogo, logoSignedUrl } from "@/lib/data";
import type { Team } from "@/lib/types";

export function TeamBrandingStep({ team, onDone }: { team: Team; onDone: () => void }) {
  const qc = useQueryClient();
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateTeam(team.id, { primary_color: primary || null, secondary_color: secondary || null });
      qc.setQueryData<Team[]>(["teams"], (teams) => teams?.map((t) => t.id === team.id ? updated : t));
      await qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team colors saved"); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save team colors"); }
    finally { setSaving(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) { toast.error("Choose an image under 3 MB"); return; }
    setSaving(true);
    try { const path = await uploadTeamLogo(team.id, file); setLogo(await logoSignedUrl(path)); await qc.invalidateQueries({ queryKey: ["teams"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not upload logo"); }
    finally { setSaving(false); }
  };
  return <Panel className="mb-3 flex flex-col gap-3 border-grape/50" aria-label="Team branding">
    <Heading className="self-center text-center">MAKE COACHSIDE YOURS</Heading>
    <TeamColorFields primary={primary} secondary={secondary} onPrimary={setPrimary} onSecondary={setSecondary} teamName={team.name} />
    <div className="flex flex-wrap items-center justify-center gap-2">
      {logo ? <img src={logo} alt={`${team.name} logo`} className="h-14 w-14 rounded-lg border border-border bg-surface object-contain" /> : null}
      <BubbleButton onClick={() => fileRef.current?.click()} disabled={saving}>Team logo (optional)</BubbleButton>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      <BubbleButton tone="grape" disabled={saving || (!!primary && !normalizeHex(primary)) || (!!secondary && !normalizeHex(secondary))} onClick={() => void save()}>{saving ? "Saving…" : "Save team colors"}</BubbleButton>
      <BubbleButton tone="ghost" disabled={saving} onClick={onDone}>Skip — use CoachSide colors</BubbleButton>
    </div>
  </Panel>;
}