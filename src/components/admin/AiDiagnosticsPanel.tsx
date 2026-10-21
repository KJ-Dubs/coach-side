import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import {
  getAiDiagnostics,
  setAiAssistantEnabled,
  type AiDiagnostics,
} from "@/lib/ai/assistant.functions";

/** Owner-only native AI Assistant diagnostics. Never reads or shows the key. */
export function AiDiagnosticsPanel() {
  const fetchDiag = useServerFn(getAiDiagnostics);
  const toggleFn = useServerFn(setAiAssistantEnabled);
  const [diag, setDiag] = useState<AiDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setDiag(await fetchDiag());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    if (!diag) return;
    setBusy(true);
    try {
      await toggleFn({ data: { enabled: !diag.enabled } });
      toast.success(!diag.enabled ? "CoachSide AI turned on" : "CoachSide AI turned off");
      setDiag(await fetchDiag());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, ok: boolean, detail: string) => (
    <div key={label} className="flex flex-wrap items-center gap-2">
      <Pill tone={ok ? "success" : "danger"}>{ok ? "PASS" : "FAIL"}</Pill>
      <Pill tone="neutral">{label}</Pill>
      <Pill tone="muted">{detail}</Pill>
    </div>
  );

  return (
    <Panel className="flex flex-col gap-2">
      <Label>10 · Native CoachSide AI Assistant</Label>
      <div className="flex flex-wrap gap-2">
        <BubbleButton size="sm" tone="grape" disabled={busy} onClick={() => void run()}>
          {busy ? "Checking…" : "Run AI checks"}
        </BubbleButton>
        {diag ? (
          <BubbleButton
            size="sm"
            tone={diag.enabled ? "danger" : "flame"}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {diag.enabled ? "Turn AI off" : "Turn AI on"}
          </BubbleButton>
        ) : null}
      </div>
      {diag ? (
        <div className="flex flex-col gap-1.5">
          {row(
            "OpenAI key configured",
            diag.keyConfigured,
            diag.keyConfigured ? "Yes" : "AI not configured",
          )}
          {row("AI endpoint reachable", diag.endpoint.ok, diag.endpoint.detail)}
          {row("Model configured", !!diag.model, diag.model)}
          {row("Assistant switch", diag.enabled, diag.enabled ? "On" : "Off")}
          {row("Assistant tables", diag.tablesOk, diag.tablesOk ? "Present" : "Missing")}
          {row("CoachSide tools", diag.tools.length > 0, diag.tools.join(", "))}
          <Pill tone="muted">
            Last 24h: {diag.usage24h.requests} requests · {diag.usage24h.tokens.toLocaleString()}{" "}
            tokens
          </Pill>
        </div>
      ) : null}
      <Note>
        Uses the same team, roster and schedule rules as the ChatGPT connector. Changes always need
        the coach's Confirm tap.
      </Note>
    </Panel>
  );
}
