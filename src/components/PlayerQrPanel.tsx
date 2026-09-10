import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { BubbleButton, Label, Panel, Pill, SelectInput } from "@/components/Bubbles";
import { ensureTeamInvite, fetchTeamInvites, joinUrl, rotateTeamInvite } from "@/lib/locker";
import type { Team } from "@/lib/types";

/**
 * Practice-friendly player onboarding: the coach holds up the screen and every
 * player scans the same reusable PLAYER invite (/join/:token) to create an
 * account and land in the authenticated Locker Room. Never the parent link.
 */
export function PlayerQrPanel({ teams }: { teams: Team[] }) {
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!teamId && teams.length) setTeamId(teams[0]!.id);
  }, [teams, teamId]);

  const team = teams.find((t) => t.id === teamId) ?? null;

  const invites = useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: () => fetchTeamInvites(teamId),
    enabled: !!teamId,
  });
  const active = (invites.data ?? []).find((i) => i.invite_type === "player" && i.active) ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-invites", teamId] });

  const create = useMutation({
    mutationFn: () => ensureTeamInvite(teamId, "player"),
    onSuccess: () => {
      setHidden(false);
      void refresh();
      toast.success("Player QR code ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replace = useMutation({
    mutationFn: () => rotateTeamInvite(teamId, "player"),
    onSuccess: () => {
      setHidden(false);
      void refresh();
      toast.success("New QR code created — the old one no longer works");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!teams.length) return null;

  const link = active ? joinUrl(active.token) : "";

  return (
    <Panel className="mb-3 flex flex-col gap-3 border-2 border-grape/70 bg-grape/10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex w-fit rounded-2xl border border-grape/60 bg-grape/25 px-4 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
          Get Your Team Into CoachSide
        </h2>
        <Pill tone="flame">Player Locker Room Access</Pill>
        {teams.length > 1 ? (
          <div className="ml-auto flex items-center gap-2">
            <Label>Team</Label>
            <SelectInput
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="max-w-[220px]"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.season}
                </option>
              ))}
            </SelectInput>
          </div>
        ) : null}
      </div>

      {!active ? (
        <div className="flex flex-col items-start gap-3">
          <Pill tone="muted">
            Create one reusable QR code your players scan at practice to join the Locker Room.
          </Pill>
          <BubbleButton
            size="lg"
            tone="flame"
            disabled={!teamId || create.isPending}
            onClick={() => create.mutate()}
            className="min-h-14 px-6 text-lg"
          >
            {create.isPending ? "Creating…" : "Create Player QR Code"}
          </BubbleButton>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {hidden ? (
            <BubbleButton size="lg" tone="grape" onClick={() => setHidden(false)}>
              Show QR code
            </BubbleButton>
          ) : (
            <span className="inline-flex shrink-0 items-center justify-center self-center rounded-3xl border-4 border-white bg-white p-4 shadow-xl shadow-black/40">
              <QRCodeSVG
                value={link}
                size={300}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                className="h-[220px] w-[220px] sm:h-[300px] sm:w-[300px]"
              />
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="inline-flex w-fit rounded-2xl border border-flame/60 bg-flame/20 px-4 py-2 text-xl font-black leading-tight text-foreground sm:text-2xl">
              {team?.name}
            </span>
            <Pill tone="muted">{team?.season}</Pill>
            <p className="rounded-2xl border border-border/70 bg-surface-2/80 px-4 py-3 text-base font-bold leading-relaxed text-foreground sm:text-lg">
              Players: scan this code, create your account, then choose your name from the roster.
            </p>
            <Pill tone="muted" className="max-w-full break-all">
              {link}
            </Pill>
            <div className="flex flex-wrap gap-2">
              <BubbleButton
                tone="grape"
                className="min-h-12"
                onClick={() => {
                  void navigator.clipboard?.writeText(link);
                  toast.success("Player join link copied");
                }}
              >
                Copy Link
              </BubbleButton>
              <a href={link} target="_blank" rel="noreferrer">
                <BubbleButton tone="neutral" className="min-h-12">
                  Open Link
                </BubbleButton>
              </a>
              <BubbleButton
                tone="flame"
                className="min-h-12"
                disabled={replace.isPending}
                onClick={() => replace.mutate()}
              >
                {replace.isPending ? "Replacing…" : "Replace QR / Link"}
              </BubbleButton>
              <BubbleButton
                tone="neutral"
                className="min-h-12"
                onClick={() => setHidden((v) => !v)}
              >
                {hidden ? "Show QR" : "Hide QR"}
              </BubbleButton>
            </div>
            <Pill tone="muted">
              Replacing the code turns off the old link immediately. Parents use the separate
              read-only stats and calendar link.
            </Pill>
          </div>
        </div>
      )}
    </Panel>
  );
}
