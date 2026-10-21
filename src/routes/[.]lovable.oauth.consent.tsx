import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton, Heading, InfoPanel, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { getCurrentUserAccess } from "@/lib/access";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABEL,
  identityScopeLabels,
  initialPermissions,
  sanitizeGrant,
  type CoachSidePermission,
} from "@/lib/mcp/permissions";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";

type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
  scope: string;
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect CoachSide — Authorize app" },
      { name: "description", content: "Approve or cancel an app's access to your CoachSide account." },
      { property: "og:title", content: "Connect CoachSide" },
      { property: "og:description", content: "Approve or cancel an app's access to your CoachSide account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection link is missing its authorization request.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search as unknown as string).get("authorization_id")
      ?? (location.search as { authorization_id?: string }).authorization_id
      ?? "";
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    if (data && "redirect_url" in data && data.redirect_url && !("client" in data)) {
      throw redirect({ href: data.redirect_url });
    }
    const access = await getCurrentUserAccess();
    return { details: data as Details, isCoach: access.isCoach };
  },
  component: Consent,
  pendingComponent: () => (
    <Shell>
      <Pill tone="muted">Loading connection request…</Pill>
    </Shell>
  ),
  errorComponent: ({ error }) => (
    <Shell>
      <Heading tone="flame">Connection request unavailable</Heading>
      <InfoPanel tone="danger">
        <p className="text-sm">
          This authorization request is invalid or has expired. Start the connection again from ChatGPT.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      </InfoPanel>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-3 py-8">
      <Panel className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <img src={wordmark.url} alt="CoachSide" className="h-14 w-auto" />
        {children}
      </Panel>
    </main>
  );
}

function hostOf(uri: string) {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

function Consent() {
  const { details, isCoach } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const start = initialPermissions(details.scope);
  const [selected, setSelected] = useState<CoachSidePermission[]>(start.selected);
  const [busy, setBusy] = useState<"allow" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientName = details.client?.name?.trim() || "This app";
  const identity = identityScopeLabels(details.scope);

  const toggle = (p: CoachSidePermission) =>
    setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  async function decide(approve: boolean) {
    setBusy(approve ? "allow" : "cancel");
    setError(null);
    try {
      if (approve) {
        const grant = sanitizeGrant(selected, start.allowed);
        if (grant.length === 0) throw new Error("Choose at least one permission, or Cancel.");
        const { error: consentError } = await supabase.rpc("mcp_record_consent", {
          p_client_id: details.client.id,
          p_client_name: details.client.name ?? "",
          p_client_uri: details.client.uri ?? "",
          p_permissions: grant,
        });
        if (consentError) throw consentError;
      }
      const { data, error: decideError } = approve
        ? await supabase.auth.oauth.approveAuthorization(authorization_id, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorization_id, { skipBrowserRedirect: true });
      if (decideError) throw decideError;
      const target = data?.redirect_url;
      if (!target) throw new Error("No redirect was returned. Start the connection again from ChatGPT.");
      window.location.href = target;
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : approve ? "Could not approve the connection." : "Could not cancel.");
    }
  }

  return (
    <Shell>
      <Heading tone="grape">Connect CoachSide to {clientName}</Heading>
      <div className="flex flex-wrap justify-center gap-2">
        <Pill tone="muted">Signed in as {details.user?.email}</Pill>
        {details.redirect_uri ? <Pill tone="muted">Returns to {hostOf(details.redirect_uri)}</Pill> : null}
      </div>
      <InfoPanel className="w-full text-left">
        <p className="text-sm">
          {clientName} will be able to use CoachSide as you, only for the permissions you allow below.
        </p>
      </InfoPanel>

      {!isCoach ? (
        <InfoPanel tone="flame" className="w-full">
          <p className="text-sm">
            Chat connections are for coach accounts. Player and parent accounts can't connect CoachSide to other apps.
          </p>
        </InfoPanel>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <Label className="self-center">Permissions</Label>
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.area} className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/70 bg-surface-2/50 p-2">
              {[g.read, g.write].map((p) => {
                const allowed = start.allowed.includes(p);
                const on = selected.includes(p) && allowed;
                return (
                  <BubbleButton
                    key={p}
                    size="sm"
                    tone={on ? "grape" : "neutral"}
                    aria-pressed={on}
                    disabled={!allowed || !!busy || start.locked}
                    onClick={() => toggle(p)}
                  >
                    {on ? "✓ " : ""}
                    {PERMISSION_LABEL[p]}
                  </BubbleButton>
                );
              })}
            </div>
          ))}
          {identity.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {identity.map((l) => (
                <Pill key={l} tone="muted">{l}</Pill>
              ))}
            </div>
          ) : null}
          <Note>
            This doesn't bypass CoachSide's coach permissions. You can revoke it anytime in Settings → ChatGPT
            integration.
          </Note>
        </div>
      )}

      {error ? (
        <InfoPanel tone="danger" role="alert" className="w-full">
          <p className="text-sm">{error}</p>
        </InfoPanel>
      ) : null}

      <div className="flex w-full flex-wrap justify-center gap-2">
        <BubbleButton
          tone="flame"
          size="lg"
          disabled={!isCoach || !!busy || selected.length === 0}
          onClick={() => void decide(true)}
        >
          {busy === "allow" ? "Connecting…" : "Allow"}
        </BubbleButton>
        <BubbleButton tone="ghost" size="lg" disabled={!!busy} onClick={() => void decide(false)}>
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </BubbleButton>
      </div>
    </Shell>
  );
}
