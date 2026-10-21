import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton, EmptyState, Heading, InfoPanel, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { CANONICAL_MCP_URL, PERMISSION_LABEL, isCoachSidePermission } from "@/lib/mcp/permissions";

type ConnectionRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
type AuditRow = { id: string; tool_name: string; summary: string; created_at: string };

async function fetchConnections() {
  const [conn, audit] = await Promise.all([
    supabase
      .from("mcp_connections")
      .select("id,client_id,client_name,permissions,created_at,updated_at,last_used_at,revoked_at")
      .order("updated_at", { ascending: false }),
    supabase.from("mcp_audit_log").select("id,tool_name,summary,created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  if (conn.error) throw conn.error;
  return { connections: (conn.data ?? []) as ConnectionRow[], audit: (audit.data ?? []) as AuditRow[] };
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Never");

/** Settings: ChatGPT / connector access for the signed-in coach. */
export function ChatGptIntegrationCard() {
  const qc = useQueryClient();
  const [help, setHelp] = useState(false);
  const q = useQuery({ queryKey: ["mcp-connections"], queryFn: fetchConnections });
  const active = (q.data?.connections ?? []).filter((c) => !c.revoked_at);
  const revoked = (q.data?.connections ?? []).filter((c) => c.revoked_at);

  const revoke = useMutation({
    mutationFn: async (clientId: string) => {
      // Ends the app's sign-in and refresh tokens, then blocks any call still in flight.
      const { error: grantError } = await supabase.auth.oauth.revokeGrant({ clientId });
      const { error } = await supabase.rpc("mcp_revoke_connection", { p_client_id: clientId });
      if (error) throw error;
      if (grantError && !/not.?found/i.test(grantError.message)) {
        console.warn("Connector sign-in could not be ended:", grantError.message);
      }
    },
    onSuccess: () => {
      toast.success("Connection revoked — your CoachSide data was not changed");
      void qc.invalidateQueries({ queryKey: ["mcp-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CANONICAL_MCP_URL);
      toast.success("Connector address copied");
    } catch {
      toast.error("Copy failed — select the address instead");
    }
  };

  return (
    <Panel className="flex flex-col gap-3 lg:col-span-2" id="chatgpt-integration">
      <div className="flex justify-center">
        <Heading tone="grape" className="text-center">ChatGPT integration</Heading>
      </div>
      <InfoPanel>
        <p className="text-center text-sm">
          Connect CoachSide to compatible ChatGPT apps so you can manage teams, rosters, and schedules from chat.
        </p>
      </InfoPanel>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Label>Connector address</Label>
        <Pill className="max-w-full select-all break-all font-mono">{CANONICAL_MCP_URL}</Pill>
        <BubbleButton size="sm" onClick={() => void copy()}>Copy</BubbleButton>
        <BubbleButton size="sm" tone="ghost" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
          {help ? "Hide steps" : "Learn how to connect"}
        </BubbleButton>
      </div>

      {help ? (
        <InfoPanel tone="grape">
          <ol className="list-decimal space-y-1 pl-5 text-left text-sm">
            <li>Connecting starts in ChatGPT, not here. In ChatGPT's apps/connectors settings, add a custom app (developer mode may be required).</li>
            <li>Paste the connector address above and choose OAuth sign-in.</li>
            <li>ChatGPT sends you to CoachSide. Sign in, pick what it may do, and tap Allow.</li>
            <li>Ask things like "Add practice Thursday at 4:30 PM for Aliso Sophomores."</li>
          </ol>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Availability of custom apps and write actions depends on your ChatGPT plan and workspace settings.
          </p>
        </InfoPanel>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Label>Status</Label>
        {q.isLoading ? (
          <Pill tone="muted">Loading…</Pill>
        ) : active.length ? (
          <Pill tone="success">{active.length} active connection{active.length > 1 ? "s" : ""}</Pill>
        ) : (
          <Pill tone="muted">Not connected</Pill>
        )}
      </div>
      {q.isError ? <EmptyState>Could not load connections</EmptyState> : null}

      {active.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-2/50 p-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="grape">{c.client_name || "Connected app"}</Pill>
            <Pill tone="muted">Connected {fmt(c.updated_at)}</Pill>
            <Pill tone="muted">Last used {fmt(c.last_used_at)}</Pill>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {c.permissions.filter(isCoachSidePermission).map((p) => (
              <Pill key={p} tone="neutral">{PERMISSION_LABEL[p]}</Pill>
            ))}
          </div>
          <div className="flex justify-center">
            <BubbleButton
              size="sm"
              tone="danger"
              disabled={revoke.isPending}
              onClick={() => {
                if (window.confirm(`Revoke ${c.client_name || "this app"}? It will stop working immediately. Your CoachSide data stays as it is.`)) {
                  revoke.mutate(c.client_id);
                }
              }}
            >
              {revoke.isPending && revoke.variables === c.client_id ? "Revoking…" : "Revoke connection"}
            </BubbleButton>
          </div>
        </div>
      ))}

      {revoked.length ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {revoked.map((c) => (
            <Pill key={c.id} tone="muted">{c.client_name || "App"} · revoked {fmt(c.revoked_at)}</Pill>
          ))}
        </div>
      ) : null}

      {q.data?.audit.length ? (
        <div className="flex flex-col items-center gap-1.5">
          <Label>Recent changes from connected apps</Label>
          {q.data.audit.map((a) => (
            <Pill key={a.id} tone="muted" className="max-w-full text-left">
              {fmt(a.created_at)} · {a.summary}
            </Pill>
          ))}
        </div>
      ) : null}
      <Note>Revoking stops the app right away and never deletes teams, players or events.</Note>
    </Panel>
  );
}
