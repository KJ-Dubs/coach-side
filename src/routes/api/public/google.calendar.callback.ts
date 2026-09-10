import { createFileRoute } from "@tanstack/react-router";

/**
 * Google OAuth redirect target. Google is configured with:
 *   https://coachside.live/api/public/google/calendar/callback
 * The one-time `state` row identifies the coach and team, so no session is
 * required here. Tokens are stored encrypted and never returned to the browser.
 */
export const Route = createFileRoute("/api/public/google/calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        const fallback = `${url.origin}/calendar`;

        const back = (target: string, params: Record<string, string>) => {
          const to = new URL(target);
          for (const [k, v] of Object.entries(params)) to.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { Location: to.toString() } });
        };

        if (!state) return back(fallback, { google: "error", reason: "missing_state" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("google_oauth_states")
          .select("state,user_id,team_id,redirect_uri,return_to,expires_at")
          .eq("state", state)
          .maybeSingle();
        await supabaseAdmin.from("google_oauth_states").delete().eq("state", state);

        if (!row) return back(fallback, { google: "error", reason: "expired_request" });
        const returnTo = row.return_to || fallback;
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return back(returnTo, { google: "error", reason: "expired_request" });
        }
        if (oauthError || !code) {
          return back(returnTo, { google: "error", reason: oauthError ?? "no_code" });
        }

        try {
          const { exchangeCode, accountEmail } = await import("@/lib/googleCalendar.server");
          const { encryptSecretValue } = await import("@/lib/googleCalendarCrypto.server");
          const tokens = await exchangeCode({ code, redirectUri: row.redirect_uri });
          const email = await accountEmail(tokens.accessToken);

          const { error } = await supabaseAdmin.from("google_calendar_connections").upsert(
            {
              user_id: row.user_id,
              team_id: row.team_id,
              access_token_ciphertext: encryptSecretValue(tokens.accessToken),
              ...(tokens.refreshToken
                ? { refresh_token_ciphertext: encryptSecretValue(tokens.refreshToken) }
                : {}),
              token_expiry: tokens.expiresAt,
              scope: tokens.scope,
              google_account_email: email,
              sync_enabled: true,
              needs_reauth: false,
              sync_status: "idle",
              last_sync_error: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "team_id" },
          );
          if (error) throw error;

          return back(returnTo, { google: "connected", team: row.team_id });
        } catch (e) {
          console.error("Google Calendar callback failed", e);
          return back(returnTo, { google: "error", reason: "exchange_failed" });
        }
      },
    },
  },
});
