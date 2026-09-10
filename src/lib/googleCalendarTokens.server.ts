/** Server-only token storage + refresh + sync engine for Google Calendar. */
import {
  GoogleAuthError,
  listEvents,
  refreshAccessToken,
  type GoogleEvent,
} from "./googleCalendar.server";
import { decryptSecretValue, encryptSecretValue } from "./googleCalendarCrypto.server";

export type ConnectionRow = {
  id: string;
  user_id: string;
  team_id: string;
  google_calendar_id: string | null;
  google_calendar_name: string | null;
  google_account_email: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  sync_status: string;
  needs_reauth: boolean;
  token_expiry: string | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
};

export const CONNECTION_COLUMNS =
  "id,user_id,team_id,google_calendar_id,google_calendar_name,google_account_email,sync_enabled,last_synced_at,last_sync_error,sync_status,needs_reauth,token_expiry,access_token_ciphertext,refresh_token_ciphertext";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getConnection(teamId: string): Promise<ConnectionRow | null> {
  const db = await admin();
  const { data } = await db
    .from("google_calendar_connections")
    .select(CONNECTION_COLUMNS)
    .eq("team_id", teamId)
    .maybeSingle();
  return (data as unknown as ConnectionRow) ?? null;
}

/** Returns a valid access token, refreshing server-side when it has expired. */
export async function accessTokenFor(row: ConnectionRow): Promise<string> {
  if (row.needs_reauth) {
    throw new GoogleAuthError("Google access was lost. Reconnect Google Calendar.");
  }
  const fresh =
    row.access_token_ciphertext &&
    row.token_expiry &&
    new Date(row.token_expiry).getTime() - 60_000 > Date.now();
  if (fresh) return decryptSecretValue(row.access_token_ciphertext!);

  if (!row.refresh_token_ciphertext) {
    throw new GoogleAuthError("Google access expired. Reconnect Google Calendar.");
  }
  const db = await admin();
  try {
    const t = await refreshAccessToken(decryptSecretValue(row.refresh_token_ciphertext));
    await db
      .from("google_calendar_connections")
      .update({
        access_token_ciphertext: encryptSecretValue(t.accessToken),
        ...(t.refreshToken
          ? { refresh_token_ciphertext: encryptSecretValue(t.refreshToken) }
          : {}),
        token_expiry: t.expiresAt,
        needs_reauth: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return t.accessToken;
  } catch (e) {
    await db
      .from("google_calendar_connections")
      .update({
        needs_reauth: true,
        sync_status: "error",
        last_sync_error: "Google authorization expired or was revoked.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new GoogleAuthError(
      e instanceof Error ? e.message : "Google authorization expired or was revoked.",
    );
  }
}

function inferType(title: string): string {
  const t = title.toLowerCase();
  if (/\bpractice\b|\bshootaround\b|\bworkout\b|\blift\b/.test(t)) return "practice";
  if (/\bgame\b|\bscrimmage\b|\btournament\b/.test(t)) return "game";
  return "other";
}

function startIso(e: GoogleEvent) {
  if (e.start?.dateTime) return e.start.dateTime;
  if (e.start?.date) return new Date(`${e.start.date}T00:00:00`).toISOString();
  return null;
}
function endIso(e: GoogleEvent) {
  if (e.end?.dateTime) return e.end.dateTime;
  // Google all-day end dates are exclusive; step back to the end of the last day.
  if (e.end?.date) return new Date(`${e.end.date}T00:00:00`).toISOString();
  return null;
}

/** Google -> CoachSide inbound sync. Never writes to Google, never deletes native events. */
export async function runSync(teamId: string): Promise<{ imported: number; cancelled: number }> {
  const db = await admin();
  const row = await getConnection(teamId);
  if (!row) throw new Error("No Google Calendar is connected for this team yet.");
  if (!row.google_calendar_id) throw new Error("Choose a Google calendar first.");
  if (!row.sync_enabled) throw new Error("Syncing is turned off for this team.");

  const token = await accessTokenFor(row);
  const now = Date.now();

  let imported = 0;
  let cancelled = 0;
  try {
    const events = await listEvents({
      accessToken: token,
      calendarId: row.google_calendar_id,
      timeMin: new Date(now - 30 * 24 * 3600 * 1000).toISOString(),
      timeMax: new Date(now + 365 * 24 * 3600 * 1000).toISOString(),
    });

    for (const ev of events) {
      const starts = startIso(ev);
      if (!starts) continue;
      const title = ev.summary?.trim() || "Team event";
      const type = inferType(title);
      const isCancelled = ev.status === "cancelled";
      const record = {
        team_id: teamId,
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
        timezone: ev.start?.timeZone ?? null,
        visibility: "team",
        status: isCancelled ? "cancelled" : "scheduled",
        last_modified_at: new Date().toISOString(),
      };
      const { error } = await db
        .from("team_events")
        .upsert(record, { onConflict: "team_id,external_calendar_id,external_event_id" });
      if (error) throw error;
      if (isCancelled) cancelled += 1;
      else imported += 1;
    }

    await db
      .from("google_calendar_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        sync_status: "ok",
        needs_reauth: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { imported, cancelled };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed.";
    await db
      .from("google_calendar_connections")
      .update({
        last_sync_error: message.slice(0, 500),
        sync_status: "error",
        ...(e instanceof GoogleAuthError ? { needs_reauth: true } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw e;
  }
}
