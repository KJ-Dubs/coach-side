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
  sync_status: string;
  needs_reauth: boolean;
  connected: boolean;
};

export type GoogleStatus = {
  configured: boolean;
  reason: string | null;
  /** Exact address Google must have registered (safe to show). */
  redirectUri: string;
  /** Last 12 characters of the client id in use — never the secret. */
  clientIdHint: string | null;
  connections: GoogleConnection[];
};

type RpcClient = {
  rpc: (
    fn: "is_team_coach",
    args: { _team: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function assertCoach(supabase: RpcClient, teamId: string) {
  const { data, error } = await supabase.rpc("is_team_coach", { _team: teamId });
  if (error || data !== true) throw new Error("You are not a coach for this team.");
}

/** Configuration + this coach's connections. Never returns tokens. */
export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleStatus> => {
    const { googleConfig, clientId, PRODUCTION_REDIRECT_URI } = await import(
      "./googleCalendar.server"
    );
    const cid = clientId();
    const cfg = googleConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_calendar_connections")
      .select(
        "id,team_id,google_calendar_id,google_calendar_name,google_account_email,sync_enabled,last_synced_at,last_sync_error,sync_status,needs_reauth,refresh_token_ciphertext",
      )
      .eq("user_id", context.userId);

    const rows = ((data ?? []) as unknown as (Omit<GoogleConnection, "connected"> & {
      refresh_token_ciphertext: string | null;
    })[]).map(({ refresh_token_ciphertext, ...rest }) => ({
      ...rest,
      connected: Boolean(refresh_token_ciphertext),
    }));
    return {
      configured: cfg.configured,
      reason: cfg.reason,
      redirectUri: PRODUCTION_REDIRECT_URI,
      clientIdHint: cid ? `…${cid.slice(-12)}` : null,
      connections: rows,
    };
  });

/** Step 1: create a one-time state row and return the Google consent URL. */
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ teamId: z.string().uuid(), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { googleConfig, buildAuthUrl, resolveOAuthTarget } = await import(
      "./googleCalendar.server"
    );
    const cfg = googleConfig();
    if (!cfg.configured) throw new Error(cfg.reason ?? "Google Calendar is not set up yet.");
    await assertCoach(context.supabase, data.teamId);

    // Canonical per-environment callback: never derived from the browser origin.
    const { redirectUri, returnOrigin } = resolveOAuthTarget(data.origin);
    const origin = returnOrigin;
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("google_calendar_connections").upsert(
      { user_id: context.userId, team_id: data.teamId, updated_at: new Date().toISOString() },
      { onConflict: "team_id" },
    );
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      state,
      user_id: context.userId,
      team_id: data.teamId,
      redirect_uri: redirectUri,
      return_to: `${origin}/calendar`,
    });
    if (error) throw error;

    return { url: buildAuthUrl({ state, redirectUri }) };
  });

/** Calendars the connected Google account can read. */
export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, data.teamId);
    const { listCalendars } = await import("./googleCalendar.server");
    const { getConnection, accessTokenFor } = await import("./googleCalendarTokens.server");
    const row = await getConnection(data.teamId);
    if (!row) throw new Error("No Google Calendar is connected for this team yet.");
    const token = await accessTokenFor(row);
    const items = await listCalendars(token);
    return items.map((c) => ({ id: c.id, name: c.summary ?? c.id, primary: Boolean(c.primary) }));
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
        sync_status: "idle",
        updated_at: new Date().toISOString(),
      })
      .eq("team_id", data.teamId);
    if (error) throw error;
    return { ok: true };
  });

/** Pull recent + upcoming Google events into team_events, without duplicates. */
export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, data.teamId);
    const { runSync } = await import("./googleCalendarTokens.server");
    return runSync(data.teamId);
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
