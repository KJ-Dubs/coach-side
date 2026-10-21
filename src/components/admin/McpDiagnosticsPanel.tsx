import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { MCP_TOOL_NAMES, TOOL_PERMISSION } from "@/lib/mcp/permissions";

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  let authServer: string | null = null;
  try {
    const r = await fetch("/.well-known/oauth-protected-resource/mcp");
    const fallback = r.ok ? r : await fetch("/.well-known/oauth-protected-resource");
    const j = (await fallback.json()) as { resource?: string; authorization_servers?: string[] };
    authServer = j.authorization_servers?.[0] ?? null;
    checks.push({ label: "Protected-resource metadata", ok: fallback.ok && !!j.resource, detail: j.resource ?? `HTTP ${fallback.status}` });
  } catch (e) {
    checks.push({ label: "Protected-resource metadata", ok: false, detail: (e as Error).message });
  }
  if (authServer) {
    try {
      const r = await fetch(`${authServer.replace(/\/$/, "")}/.well-known/oauth-authorization-server`);
      const j = (await r.json()) as { code_challenge_methods_supported?: string[]; registration_endpoint?: string };
      const s256 = (j.code_challenge_methods_supported ?? []).includes("S256");
      checks.push({ label: "Authorization server (PKCE S256)", ok: r.ok && s256, detail: s256 ? "S256 advertised" : "S256 missing" });
      checks.push({ label: "Client registration", ok: !!j.registration_endpoint, detail: j.registration_endpoint ? "Enabled" : "Not advertised" });
    } catch (e) {
      checks.push({ label: "Authorization server", ok: false, detail: (e as Error).message });
    }
  }
  try {
    const r = await fetch("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const challenge = r.headers.get("www-authenticate") ?? "";
    checks.push({
      label: "Connector endpoint rejects anonymous calls",
      ok: r.status === 401 && /resource_metadata/i.test(challenge),
      detail: `HTTP ${r.status}${challenge ? " · Bearer challenge present" : ""}`,
    });
  } catch (e) {
    checks.push({ label: "Connector endpoint", ok: false, detail: (e as Error).message });
  }
  for (const table of ["mcp_connections", "mcp_audit_log"] as const) {
    const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
    checks.push({ label: `Table ${table}`, ok: !error, detail: error ? error.message : "Present" });
  }
  return checks;
}

/** Owner-only connector diagnostics. Never reads or shows tokens. */
export function McpDiagnosticsPanel() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Panel className="flex flex-col gap-2">
      <Label>9 · ChatGPT connector (MCP)</Label>
      <div className="flex flex-wrap gap-2">
        <BubbleButton
          size="sm"
          tone="grape"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setChecks(await runChecks());
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Run connector checks"}
        </BubbleButton>
      </div>
      {checks ? (
        <div className="flex flex-col gap-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex flex-wrap items-center gap-2">
              <Pill tone={c.ok ? "success" : "danger"}>{c.ok ? "OK" : "FAIL"}</Pill>
              <Pill>{c.label}</Pill>
              <Pill tone="muted" className="break-all">{c.detail}</Pill>
            </div>
          ))}
        </div>
      ) : null}
      <Label>Tools</Label>
      <div className="flex flex-wrap gap-1.5">
        {MCP_TOOL_NAMES.map((t) => (
          <Pill key={t} tone="muted">{t} · {TOOL_PERMISSION[t].replace("coachside:", "")}</Pill>
        ))}
      </div>
      <Note>Read-only checks. No tokens are read or displayed.</Note>
    </Panel>
  );
}
