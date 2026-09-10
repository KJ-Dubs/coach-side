import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BubbleButton, Label, Panel, Pill, SelectInput } from "@/components/Bubbles";
import {
  disconnectGoogleCalendar,
  finishGoogleCalendarConnect,
  getGoogleCalendarStatus,
  listGoogleCalendars,
  setGoogleCalendarMapping,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
} from "@/lib/googleCalendar.functions";

const PENDING_TEAM = "coachside.google.pendingTeam";

function fmt(ts: string | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GoogleCalendarPanel({
  teamId,
  teamName,
  canManage,
}: {
  teamId: string | null;
  teamName: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const status = useServerFn(getGoogleCalendarStatus);
  const start = useServerFn(startGoogleCalendarConnect);
  const finish = useServerFn(finishGoogleCalendarConnect);
  const listCals = useServerFn(listGoogleCalendars);
  const setMapping = useServerFn(setGoogleCalendarMapping);
  const sync = useServerFn(syncGoogleCalendar);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");

  const q = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => status({}),
    enabled: canManage,
  });

  const connection = useMemo(
    () => (q.data?.connections ?? []).find((c) => c.team_id === teamId) ?? null,
    [q.data, teamId],
  );

  const refresh = () => void qc.invalidateQueries({ queryKey: ["google-calendar-status"] });

  const finishConnect = useMutation({
    mutationFn: (v: { teamId: string; code: string }) => finish({ data: v }),
    onSuccess: () => {
      toast.success("Google account connected");
      setPicking(true);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // The gateway sends the coach back here with a one-time code.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("google_code") ?? url.searchParams.get("code");
    const pending = window.sessionStorage.getItem(PENDING_TEAM);
    if (!code || !pending) return;
    window.sessionStorage.removeItem(PENDING_TEAM);
    url.searchParams.delete("google_code");
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());
    finishConnect.mutate({ teamId: pending, code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cals = useQuery({
    queryKey: ["google-calendar-list", teamId],
    queryFn: () => listCals({ data: { teamId: teamId! } }),
    enabled: Boolean(teamId) && picking && Boolean(connection?.connected),
  });

  const beginConnect = useMutation({
    mutationFn: async () => {
      if (!teamId) throw new Error("Choose a team first.");
      window.sessionStorage.setItem(PENDING_TEAM, teamId);
      const redirectUri = `${window.location.origin}/calendar`;
      const { url } = await start({ data: { teamId, redirectUri } });
      window.location.href = url;
    },
    onError: (e: Error) => {
      window.sessionStorage.removeItem(PENDING_TEAM);
      toast.error(e.message);
    },
  });

  const saveMapping = useMutation({
    mutationFn: async () => {
      const cal = (cals.data ?? []).find((c) => c.id === choice);
      if (!teamId || !cal) throw new Error("Pick a calendar.");
      await setMapping({
        data: { teamId, calendarId: cal.id, calendarName: cal.name },
      });
      return sync({ data: { teamId } });
    },
    onSuccess: (r) => {
      toast.success(`Synced ${r.imported} event${r.imported === 1 ? "" : "s"}`);
      setPicking(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncNow = useMutation({
    mutationFn: () => sync({ data: { teamId: teamId! } }),
    onSuccess: (r) => {
      toast.success(`Synced ${r.imported} event${r.imported === 1 ? "" : "s"}`);
      refresh();
      void qc.invalidateQueries({ queryKey: ["team-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: () => disconnect({ data: { teamId: teamId! } }),
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      setPicking(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) return null;

  return (
    <Panel className="mb-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-2xl border border-flame/50 bg-flame/10 px-3 py-2 text-xl font-black leading-tight text-foreground">
          Google Calendar
        </span>
        {q.data && !q.data.configured ? (
          <Pill tone="danger">Setup needed</Pill>
        ) : connection?.connected && connection.google_calendar_id ? (
          <Pill tone="success">Connected</Pill>
        ) : (
          <Pill tone="muted">Not connected</Pill>
        )}
      </div>

      {q.isLoading ? <Label>Checking connection…</Label> : null}

      {q.data && !q.data.configured ? (
        <div className="rounded-2xl border border-border bg-surface-2/70 p-3">
          <Label>
            {q.data.reason ??
              "Google Calendar is not set up for this workspace yet."}{" "}
            Once it is set up, this button connects your Google account.
          </Label>
        </div>
      ) : null}

      {q.data?.configured && !connection?.connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <BubbleButton
            tone="flame"
            disabled={!teamId || beginConnect.isPending}
            onClick={() => beginConnect.mutate()}
          >
            Connect Google Calendar
          </BubbleButton>
          <Label>Imports games and practices into {teamName}</Label>
        </div>
      ) : null}

      {connection?.connected ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Pill tone="muted">Account: {connection.google_account_email ?? "Google account"}</Pill>
            <Pill tone="muted">
              Calendar: {connection.google_calendar_name ?? "Not chosen yet"}
            </Pill>
            <Pill tone="grape">Team: {teamName}</Pill>
            <Pill tone="muted">Last synced: {fmt(connection.last_synced_at)}</Pill>
          </div>
          {connection.last_sync_error ? (
            <div className="rounded-2xl border border-flame/50 bg-flame/10 p-3">
              <Label>Last sync problem: {connection.last_sync_error}</Label>
            </div>
          ) : null}

          {picking || !connection.google_calendar_id ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label>Choose calendar</Label>
              <SelectInput value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Select a Google calendar…</option>
                {(cals.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.primary ? " (primary)" : ""}
                  </option>
                ))}
              </SelectInput>
              <BubbleButton
                tone="grape"
                disabled={!choice || saveMapping.isPending}
                onClick={() => saveMapping.mutate()}
              >
                Save & sync
              </BubbleButton>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <BubbleButton
              size="sm"
              tone="flame"
              disabled={syncNow.isPending || !connection.google_calendar_id}
              onClick={() => syncNow.mutate()}
            >
              Sync now
            </BubbleButton>
            <BubbleButton
              size="sm"
              tone="neutral"
              onClick={() => {
                setPicking(true);
                void cals.refetch();
              }}
            >
              Change calendar
            </BubbleButton>
            <BubbleButton
              size="sm"
              tone="neutral"
              disabled={drop.isPending}
              onClick={() => drop.mutate()}
            >
              Disconnect
            </BubbleButton>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
