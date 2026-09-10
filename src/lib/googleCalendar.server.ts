/**
 * Server-only Google Calendar helpers. The OAuth client secret and the coach's
 * Google tokens never leave the server: the browser only ever sees the Google
 * consent URL and non-sensitive connection status.
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_API = "https://www.googleapis.com";
/** Path Google must be configured to redirect back to. */
export const CALLBACK_PATH = "/api/public/google/calendar/callback";

/** Least privilege: read calendars/events plus the account email. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export function clientId(): string | null {
  return process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? null;
}
export function clientSecret(): string | null {
  return process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? null;
}

export type ConfigState = { configured: boolean; reason: string | null };

export function googleConfig(): ConfigState {
  const missing: string[] = [];
  if (!clientId()) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret()) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!process.env["GOOGLE_TOKEN_ENC_KEY"]) missing.push("GOOGLE_TOKEN_ENC_KEY");
  if (missing.length) {
    return {
      configured: false,
      reason: `Google Calendar is not set up yet. Missing server settings: ${missing.join(", ")}.`,
    };
  }
  return { configured: true, reason: null };
}

export function buildAuthUrl(input: { state: string; redirectUri: string }): string {
  const p = new URLSearchParams({
    client_id: clientId() ?? "",
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
  });
  return `${GOOGLE_AUTH_URL}?${p.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string | null;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google sign-in failed [${res.status}]: ${text}`);
  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3500) * 1000).toISOString(),
    scope: json.scope ?? null,
  };
}

export function exchangeCode(input: { code: string; redirectUri: string }) {
  return tokenRequest({
    code: input.code,
    client_id: clientId() ?? "",
    client_secret: clientSecret() ?? "",
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId() ?? "",
    client_secret: clientSecret() ?? "",
    grant_type: "refresh_token",
  });
}

/** Thrown when Google auth is expired/revoked so the UI can offer Reconnect. */
export class GoogleAuthError extends Error {}

export async function googleGet<T>(input: {
  accessToken: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(input.query ?? {})) if (v != null) qs.set(k, v);
  const res = await fetch(`${GOOGLE_API}${input.path}${qs.size ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`Google access was refused [${res.status}]. Reconnect required.`);
  }
  if (!res.ok) throw new Error(`Google request failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as T;
}

export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
};

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const json = await googleGet<{ items?: GoogleCalendarListItem[] }>({
    accessToken,
    path: "/calendar/v3/users/me/calendarList",
    query: { maxResults: "100", minAccessRole: "reader" },
  });
  return json.items ?? [];
}

export async function listEvents(input: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i += 1) {
    const json = await googleGet<{ items?: GoogleEvent[]; nextPageToken?: string }>({
      accessToken: input.accessToken,
      path: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
      query: {
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        singleEvents: "true",
        showDeleted: "true",
        orderBy: "startTime",
        maxResults: "250",
        pageToken,
      },
    });
    out.push(...(json.items ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}

/** Best-effort read of the signed-in Google account email. */
export async function accountEmail(accessToken: string): Promise<string | null> {
  try {
    const json = await googleGet<{ email?: string }>({
      accessToken,
      path: "/oauth2/v2/userinfo",
    });
    return json.email ?? null;
  } catch {
    return null;
  }
}
