/**
 * Server-only helpers for talking to Google Calendar on behalf of a signed-in
 * coach, through the Lovable connector gateway. Google credentials never reach
 * the browser: the gateway holds the tokens and we only store an opaque,
 * encrypted per-user connection key.
 */

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "google_calendar";

/** Least-privilege: read-only calendar access plus the account email. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export function clientApiKey(): string | null {
  return process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"] ?? null;
}

export function lovableApiKey(): string | null {
  return process.env["LOVABLE_API_KEY"] ?? null;
}

export type ConfigState = { configured: boolean; reason: string | null };

export function connectorConfig(): ConfigState {
  if (!clientApiKey()) {
    return {
      configured: false,
      reason:
        "Google Calendar is not set up for this workspace yet. A workspace admin must add the Google Calendar app-user connector client.",
    };
  }
  if (!lovableApiKey()) {
    return { configured: false, reason: "Server connector credentials are missing." };
  }
  if (!process.env["APP_USER_CONNECTION_KEY_SECRET"]) {
    return {
      configured: false,
      reason: "Secure storage for Google connections is not available yet.",
    };
  }
  return { configured: true, reason: null };
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${lovableApiKey()}`,
    "X-Connection-Api-Key": clientApiKey() ?? "",
    "Content-Type": "application/json",
  };
}

async function readError(res: Response) {
  const body = await res.text();
  return `Google request failed [${res.status}]: ${body}`;
}

/** Start per-user consent. Returns the URL the coach should be sent to. */
export async function startAuthorize(input: {
  appUserId: string;
  redirectUri: string;
  connectionKey?: string | null;
}): Promise<string> {
  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({
      app_user_id: input.appUserId,
      connector_id: CONNECTOR_ID,
      redirect_uri: input.redirectUri,
      ...(input.connectionKey ? { connection_api_key: input.connectionKey } : {}),
      credentials_configuration: { scopes: GOOGLE_SCOPES },
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as {
    authorization_url?: string;
    url?: string;
    redirect_url?: string;
  };
  const url = json.authorization_url ?? json.url ?? json.redirect_url;
  if (!url) throw new Error("Connector gateway did not return a Google sign-in link.");
  return url;
}

/** Exchange the one-time code from the callback for the durable connection key. */
export async function exchangeCode(input: {
  appUserId: string;
  code: string;
}): Promise<string> {
  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({
      app_user_id: input.appUserId,
      connector_id: CONNECTOR_ID,
      code: input.code,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { connection_api_key?: string; connection_key?: string };
  const key = json.connection_api_key ?? json.connection_key;
  if (!key) throw new Error("Connector gateway did not return a connection key.");
  return key;
}

/** Call a Google Calendar API path as the connected coach. */
export async function callAsAppUser<T>(input: {
  connectionKey: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(input.query ?? {})) if (v != null) qs.set(k, v);
  const url = `${GATEWAY_BASE_URL}/${CONNECTOR_ID}${input.path}${qs.size ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableApiKey()}`,
      "X-Connection-Api-Key": input.connectionKey,
    },
  });
  if (!res.ok) throw new Error(await readError(res));
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

export async function listCalendars(connectionKey: string): Promise<GoogleCalendarListItem[]> {
  const json = await callAsAppUser<{ items?: GoogleCalendarListItem[] }>({
    connectionKey,
    path: "/calendar/v3/users/me/calendarList",
    query: { maxResults: "100", minAccessRole: "reader" },
  });
  return json.items ?? [];
}

export async function listEvents(input: {
  connectionKey: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i += 1) {
    const json = await callAsAppUser<{ items?: GoogleEvent[]; nextPageToken?: string }>({
      connectionKey: input.connectionKey,
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

/** Best-effort read of the connected Google account email. */
export async function accountEmail(connectionKey: string): Promise<string | null> {
  try {
    const json = await callAsAppUser<{ id?: string }>({
      connectionKey,
      path: "/calendar/v3/calendars/primary",
    });
    return json.id && json.id.includes("@") ? json.id : null;
  } catch {
    return null;
  }
}
