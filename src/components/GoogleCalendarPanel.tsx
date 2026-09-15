import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BubbleButton, InfoPanel, Label, Panel, Pill, SelectInput } from "@/components/Bubbles";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  listGoogleCalendars,
  setGoogleCalendarMapping,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
} from "@/lib/googleCalendar.functions";

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
  const listCals = useServerFn(listGoogleCalendars);
  const setMapping = useServerFn(setGoogleCalendarMapping);
  const sync = useServerFn(syncGoogleCalendar);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const [picking, setPicking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
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

  // Google sends the coach back here after consent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get("google");
    if (!result) return;
    const reason = url.searchParams.get("reason");
    url.searchParams.delete("google");
    url.searchParams.delete("reason");
    url.searchParams.delete("team");
    window.history.replaceState({}, "", url.toString());
    if (result === "connected") {
      toast.success("Google account connected — now choose a calendar");
      setPicking(true);
      refresh();
    } else {
      setLastError(reason ?? "unknown");
      toast.error(`Google connection failed${reason ? ` (${reason})` : ""}`);
    }
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
      const { url } = await start({ data: { teamId, origin: window.location.origin } });
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMapping = useMutation({
    mutationFn: async () => {
      const cal = (cals.data ?? []).find((c) => c.id === choice);
      if (!teamId || !cal) throw new Error("Pick a calendar.");
      await setMapping({ data: { teamId, calendarId: cal.id, calendarName: cal.name } });
      return sync({ data: { teamId } });
    },
    onSuccess: (r) => {
      toast.success(`Synced ${r.imported} event${r.imported === 1 ? "" : "s"}`);
      setPicking(false);
      refresh();
      void qc.invalidateQueries({ queryKey: ["team-events"] });
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
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
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

  const needsReauth = Boolean(connection?.needs_reauth);

  return (
    <Panel className="mb-3 flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-xl font-black leading-tight text-foreground">
          Google Calendar
        </span>
        {q.data && !q.data.configured ? (
          <Pill tone="danger">Setup needed</Pill>
        ) : needsReauth ? (
          <Pill tone="danger">Reconnect needed</Pill>
        ) : connection?.connected && connection.google_calendar_id ? (
          <Pill tone="success">Connected</Pill>
        ) : (
          <Pill tone="muted">Not connected</Pill>
        )}
      </div>

      {q.isLoading ? <Label>Checking connection…</Label> : null}

      {q.data ? (
        <InfoPanel>
          <ul className="space-y-2"><li><strong>Callback address:</strong> {q.data.redirectUri}</li><li><strong>Google app ID ends:</strong> {q.data.clientIdHint ?? "not set"}</li>{lastError ? <li className="text-destructive"><strong>Last Google error:</strong> {lastError}</li> : null}</ul>
        </InfoPanel>
      ) : null}

      {q.data && !q.data.configured ? (
        <div className="rounded-2xl border border-border bg-surface-2/70 p-3">
          <Label>{q.data.reason ?? "Google Calendar is not set up for this app yet."}</Label>
        </div>
      ) : null}

      {q.data?.configured && (!connection?.connected || needsReauth) ? (
        <div className="flex flex-wrap items-center gap-2">
          <BubbleButton
            tone="flame"
            disabled={!teamId || beginConnect.isPending}
            onClick={() => beginConnect.mutate()}
          >
            {needsReauth ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </BubbleButton>
          <Label>Brings games and practices into {teamName}</Label>
        </div>
      ) : null}

      {connection?.connected ? (
        <>
          <InfoPanel><ul className="space-y-2"><li><strong>Account:</strong> {connection.google_account_email ?? "Google account"}</li><li><strong>Calendar:</strong> {connection.google_calendar_name ?? "Not chosen yet"}</li><li><strong>Team:</strong> {teamName}</li><li><strong>Last synced:</strong> {fmt(connection.last_synced_at)}</li></ul></InfoPanel>
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
