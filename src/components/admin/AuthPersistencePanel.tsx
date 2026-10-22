import { useQuery } from "@tanstack/react-query";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import { rememberDevice } from "@/lib/remember";
import { authPersistenceDiagnostics } from "@/lib/sessionResume";

/** Sign-in persistence facts for this device. Shows no tokens or secrets. */
export function AuthPersistencePanel() {
  const q = useQuery({ queryKey: ["auth-persistence-diag"], queryFn: authPersistenceDiagnostics });
  const d = q.data;
  const yes = (on: boolean, y = "Yes", n = "No") => <Pill tone={on ? "success" : "flame"}>{on ? y : n}</Pill>;
  return (
    <Panel className="flex flex-col gap-2">
      <Label>Sign-in persistence (this device)</Label>
      {d ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Pill>Storage</Pill><Pill tone="muted">{d.storage}</Pill>
            <Pill>Keep session</Pill>{yes(d.persistSession, "ON", "OFF")}
            <Pill>Auto refresh</Pill>{yes(d.autoRefreshToken, "ON", "OFF")}
            <Pill>Remember device</Pill>{yes(rememberDevice(), "ON", "OFF")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>Signed in</Pill>{yes(d.signedIn)}
            <Pill>Refresh token present</Pill>{yes(d.refreshTokenPresent)}
            <Pill tone="muted">Access expires {d.expiresAt ? d.expiresAt.toLocaleString() : "—"}</Pill>
            <Pill tone="muted">{d.installedApp ? "Installed app" : "Browser tab"} · {d.host}</Pill>
          </div>
          <Note>
            Access tokens expire about hourly and refresh automatically; a bad connection keeps the
            stored sign-in. Only a revoked or invalid session asks for sign-in again.
          </Note>
        </>
      ) : (
        <Pill tone="muted">Checking…</Pill>
      )}
      <div>
        <BubbleButton size="sm" tone="neutral" onClick={() => void q.refetch()}>Re-check</BubbleButton>
      </div>
    </Panel>
  );
}
