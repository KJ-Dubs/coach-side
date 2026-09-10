import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoogleConnection = {
  id: string;
  team_id: string;
  google_calendar_id: string | null;
  google_calendar_name: string | null;
  google_account_email: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  connected: boolean;
};

export type GoogleStatus = {
  configured: boolean;
  reason: string | null;
  connections: GoogleConnection[];
};

const CONNECTION_COLUMNS =
  "id,team_id,google_calendar_id,google_calendar_name,google_account_email,sync_enabled,last_synced_at,last_sync_error,connection_key_ciphertext";

type Row = {
  id: string;
  team_id: string;
  google_calendar_id: string | null;
  google_calendar_name: string | null;
  google_account_email: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  connection_key_ciphertext: string | null;
};

function present(row: Row): GoogleConnection {
  const { connection_key_ciphertext, ...rest } = row;
  return { ...rest, connected: Boolean(connection_key_ciphertext) };
}

type RpcClient = {
  rpc: (fn: "is_team_coach", args: { _team: string }) => PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
};

async function assertCoach(supabase: RpcClient, teamId: string) {
  const { data, error } = await supabase.rpc("is_team_coach", { _team: teamId });
  if (error || data !== true) throw new Error("You are not a coach for this team.");
}

/** Connector configuration + this coach's connections. Never returns credentials. */
export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleStatus> => {
    const { connectorConfig } = await import("./googleCalendar.server");
    const cfg = connectorConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_calendar_connections")
      .select(CONNECTION_COLUMNS)
      .eq("user_id", context.userId);
    const rows = ((data ?? []) as unknown as Row[]).map(present);
    return { configured: cfg.configured, reason: cfg.reason, connections: rows };
  });

/** Step 1: begin Google consent for a team. Returns the Google sign-in URL. */
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), redirectUri: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { connectorConfig, startAuthorize } = await import("./googleCalendar.server");
    const cfg = connectorConfig();
    if (!cfg.configured) throw new Error(cfg.reason ?? "Google Calendar is not set up yet.");
    await assertCoach(context.supabase, data.teamId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("google_calendar_connections").upsert(
      { user_id: context.userId, team_id: data.teamId, updated_at: new Date().toISOString() },
      { onConflict: "team_id" },
    );

    const url = await startAuthorize({
      appUserId: context.userId,
      redirectUri: data.redirectUri,
    });
    return { url };
  });

/** Step 2: exchange the callback code and store the connection for the team. */
export const finishGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), code: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { connectorConfig, exchangeCode, accountEmail } = await import(
      "./googleCalendar.server"
    );
    const { encryptConnectionKey } = await import("./googleCalendarCrypto.server");
    const cfg = connectorConfig();
    if (!cfg.configured) throw new Error(cfg.reason ?? "Google Calendar is not set up yet.");
    await assertCoach(context.supabase, data.teamId);

    const key = await exchangeCode({ appUserId: context.userId, code: data.code });
    const email = await accountEmail(key);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_calendar_connections").upsert(
      {
        user_id: context.userId,
        team_id: data.teamId,
        connection_key_ciphertext: encryptConnectionKey(key),
        google_account_email: email,
        sync_enabled: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

async function loadKey(teamId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptConnectionKey } = await import("./googleCalendarCrypto.server");
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select(CONNECTION_COLUMNS)
    .eq("team_id", teamId)
    .maybeSingle();
  const row = data as unknown as Row | null;
  if (!row || row.connection_key_ciphertext == null) {
    throw new Error("No Google Calendar is connected for this team yet.");
  }
  if (userId && row.id) {
    // ownership is enforced by the coach check on the team, not by user match
  }
  return { row, key: decryptConnectionKey(row.connection_key_ciphertext), supabaseAdmin };
}

/** Calendars the connected Google account can read. */
export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { listCalendars } = await import("./googleCalendar.server");
    await assertCoach(context.supabase, data.teamId);
    const { key } = await loadKey(data.teamId, context.userId);
    const items = await listCalendars(key);
    return items.map((c) => ({
      id: c.id,
      name: c.summary ?? c.id,
      primary: Boolean(c.primary),
    }));
  });

/** Pick which Google calendar feeds this team. */
export const setGoogleCalendarMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        teamId: z.string().uuid(),
        calendarId: z.string().min(1),
        calendarName: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertCoach(context.supabase, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_calendar_connections")
      .update({
        google_calendar_id: data.calendarId,
        google_calendar_name: data.calendarName,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("team_id", data.teamId);
    if (error) throw error;
    return { ok: true };
  });

function inferType(title: string): string {
  const t = title.toLowerCase();
  if (/\bgame\b|\bvs\.?\b|\bat\b\s+\w+|scrimmage/.test(t)) return "game";
  if (/practice|workout|lift|shootaround/.test(t)) return "practice";
  return "other";
}

function startIso(e: { start?: { dateTime?: string; date?: string } }) {
  return e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : null);
}
function endIso(e: { end?: { dateTime?: string; date?: string } }) {
  return e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00Z` : null);
}

/** Pull recent + upcoming Google events into team_events, without duplicates. */
export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { listEvents } = await import("./googleCalendar.server");
    await assertCoach(context.supabase, data.teamId);
    const { row, key, supabaseAdmin } = await loadKey(data.teamId, context.userId);
    if (!row.google_calendar_id) throw new Error("Choose a Google calendar first.");
    if (!row.sync_enabled) throw new Error("Syncing is turned off for this team.");

    const now = Date.now();
    const timeMin = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(now + 365 * 24 * 3600 * 1000).toISOString();

    let imported = 0;
    let cancelled = 0;
    try {
      const events = await listEvents({
        connectionKey: key,
        calendarId: row.google_calendar_id,
        timeMin,
        timeMax,
      });

      for (const ev of events) {
        const starts = startIso(ev);
        if (!starts) continue;
        const title = ev.summary?.trim() || "Team event";
        const type = inferType(title);
        const base = {
          team_id: data.teamId,
          source: "google",
          external_provider: "google_calendar",
          external_calendar_id: row.google_calendar_id,
          external_event_id: ev.id,
          external_updated_at: ev.updated ?? null,
          title,
          event_type: type,
          kind: type === "game" || type === "practice" ? type : "event",
          starts_at: starts,
          ends_at: endIso(ev),
          location: ev.location ?? null,
          notes: ev.description ?? null,
          visibility: "team",
          status: ev.status === "cancelled" ? "cancelled" : "scheduled",
          last_modified_at: new Date().toISOString(),
        };
        const { error } = await supabaseAdmin
          .from("team_events")
          .upsert(base as never, {
            onConflict: "team_id,external_provider,external_calendar_id,external_event_id",
          });
        if (error) throw error;
        if (ev.status === "cancelled") cancelled += 1;
        else imported += 1;
      }

      await supabaseAdmin
        .from("google_calendar_connections")
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
        .eq("team_id", data.teamId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await supabaseAdmin
        .from("google_calendar_connections")
        .update({ last_sync_error: message })
        .eq("team_id", data.teamId);
      throw err;
    }

    return { imported, cancelled };
  });

/** Stop syncing. Imported events stay; native CoachSide events are untouched. */
export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertCoach(context.supabase, data.teamId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("google_calendar_connections")
      .delete()
      .eq("team_id", data.teamId);
    if (error) throw error;
    return { ok: true };
  });
