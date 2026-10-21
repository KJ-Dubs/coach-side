import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BubbleButton, InfoPanel, Panel, Pill } from "@/components/Bubbles";
import { AI_ASSISTANT_ANCHOR, useAiAssistantStatus } from "@/lib/aiAssistant";

/** Compact Home card pointing coaches to the CoachSide AI Assistant setup in Settings. */
export function AiAssistantHomeCard() {
  const status = useAiAssistantStatus();
  const connected = (status.data?.activeCount ?? 0) > 0;
  return (
    <Panel className="grid gap-3 px-4 py-4 text-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:text-left">
      <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 className="inline-flex items-center gap-2 rounded-full border border-grape/40 bg-grape/10 px-3 py-1 text-base font-black text-foreground">
            <Sparkles className="h-4 w-4 text-grape" aria-hidden />
            CoachSide AI Assistant
          </h2>
          {connected ? <Pill tone="success">Connected</Pill> : null}
        </div>
        <InfoPanel className="text-sm">
          Use ChatGPT to help manage CoachSide — add roster players, create teams, and update your schedule from chat.
        </InfoPanel>
      </div>
      <Link to="/settings" hash={AI_ASSISTANT_ANCHOR} className="justify-self-center">
        <BubbleButton tone={connected ? "neutral" : "grape"}>
          {connected ? "Manage AI Assistant" : "Connect Chat GPT"}
        </BubbleButton>
      </Link>
    </Panel>
  );
}
