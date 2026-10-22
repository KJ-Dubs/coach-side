import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { BubbleButton, Note, Panel, Pill } from "@/components/Bubbles";
import { ensureTeamInvite, fetchTeamInvites, joinUrl, rotateTeamInvite } from "@/lib/locker";

/**
 * Coach-only compact player invite for the Locker Room hub: shows (or creates
 * on demand) the current team's live PLAYER invite so it can be copied or
 * shared in one tap. Advanced access controls stay in Settings.
 */
export function InvitePlayersPanel({ teamId, teamName, onClose }: { teamId: string; teamName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [showQr, setShowQr] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const autoCreated = useRef<string | null>(null);

  const invites = useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: () => fetchTeamInvites(teamId),
  });
  const active = (invites.data ?? []).find((i) => i.invite_type === "player" && i.active) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["team-invites", teamId] });

  const create = useMutation({
    mutationFn: () => ensureTeamInvite(teamId, "player"),
    onSuccess: () => void refresh(),
  });
  const replace = useMutation({
    mutationFn: () => rotateTeamInvite(teamId, "player"),
    onSuccess: async (inv) => {
      setConfirmReplace(false);
      await refresh();
      void navigator.clipboard?.writeText(joinUrl(inv.token)).catch(() => undefined);
      toast.success("New link created and copied — the old link no longer works");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // No live player link yet: create one right away so the coach never visits Settings.
  useEffect(() => {
    if (!invites.isSuccess || active || autoCreated.current === teamId) return;
    autoCreated.current = teamId;
    create.mutate();
  }, [invites.isSuccess, active, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = active ? joinUrl(active.token) : "";
  const display = link.replace(/^https?:\/\//, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Player link copied");
    } catch {
      toast.error("Could not copy — press and hold the link to copy it");
    }
  };

  const share = async () => {
    const data = {
      title: `Join ${teamName} on CoachSide`,
      text: `Join ${teamName} in the CoachSide Locker Room — create your player account and pick your name.`,
      url: link,
    };
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <Panel className="mb-3 flex flex-col gap-3 border-2 border-grape/70 bg-grape/10">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="grape">Invite Players</Pill>
        <Pill tone="muted">{teamName}</Pill>
        {active ? <Pill tone="success">Link is live</Pill> : null}
        <BubbleButton size="sm" tone="ghost" className="ml-auto" onClick={onClose} aria-label="Close invite panel">
          ✕
        </BubbleButton>
      </div>

      {active ? (
        <>
          <span className="block max-w-full truncate rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-sm font-bold text-foreground" title={link}>
            {display}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <BubbleButton tone="grape" onClick={() => void share()}>
              Share Link
            </BubbleButton>
            <BubbleButton tone="flame" onClick={() => void copy()}>
              Copy Player Link
            </BubbleButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <BubbleButton size="sm" tone="neutral" onClick={() => setShowQr((v) => !v)}>
              {showQr ? "Hide QR code" : "Show QR code"}
            </BubbleButton>
            <BubbleButton size="sm" tone="ghost" onClick={() => setConfirmReplace(true)}>
              Replace link
            </BubbleButton>
            <Link
              to="/settings"
              hash="locker-access"
              className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface-2/70 px-3 text-xs font-black text-foreground"
            >
              Manage access
            </Link>
          </div>
          {showQr ? (
            <div className="flex justify-center">
              <div className="rounded-2xl border border-border bg-card p-3">
                <QRCodeSVG value={link} size={200} bgColor="#ffffff" fgColor="#111111" includeMargin />
              </div>
            </div>
          ) : null}
          {confirmReplace ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-flame/60 bg-flame/10 p-3">
              <Note>The current link and QR code will stop working. Players who already joined keep their access.</Note>
              <div className="flex flex-wrap gap-2">
                <BubbleButton size="sm" tone="flame" disabled={replace.isPending} onClick={() => replace.mutate()}>
                  Replace and copy new link
                </BubbleButton>
                <BubbleButton size="sm" tone="ghost" onClick={() => setConfirmReplace(false)}>
                  Cancel
                </BubbleButton>
              </div>
            </div>
          ) : null}
          <Note>Players open the link, create an account and pick their name from your roster.</Note>
        </>
      ) : create.isError ? (
        <div className="flex flex-col gap-2">
          <Note>
            {create.error instanceof Error ? create.error.message : "Could not create the player link."}
          </Note>
          <div className="flex flex-wrap gap-2">
            <BubbleButton size="sm" tone="grape" onClick={() => create.mutate()}>
              Try again
            </BubbleButton>
            <Link to="/settings" hash="locker-access" className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface-2/70 px-3 text-xs font-black text-foreground">
              Manage access
            </Link>
          </div>
        </div>
      ) : (
        <Pill tone="muted">{invites.isError ? "Could not load the player link" : "Getting your player link…"}</Pill>
      )}
    </Panel>
  );
}
