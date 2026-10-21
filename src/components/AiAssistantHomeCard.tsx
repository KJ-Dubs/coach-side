import aiMark from "@/assets/coachside-ai-mark.png";
import { BubbleButton, InfoPanel, Panel, Pill } from "@/components/Bubbles";
import { openAiAssistant, useAiAvailability } from "@/lib/aiAssistant";

/** Home card that opens the native CoachSide AI Assistant. */
export function AiAssistantHomeCard() {
  const availability = useAiAvailability();
  const available = !!availability.data?.available;
  return (
    <Panel className="grid gap-3 px-4 py-4 text-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:text-left">
      <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 className="inline-flex items-center gap-2 rounded-full border border-grape/40 bg-grape/10 px-3 py-1 text-base font-black text-foreground">
            <img src={aiMark} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
            CoachSide AI Assistant
          </h2>
          {!availability.isLoading && !available ? <Pill tone="muted">Coming soon</Pill> : null}
        </div>
        <InfoPanel className="text-sm">
          Ask CoachSide AI to manage your roster, schedule, and team — or get basketball coaching help.
        </InfoPanel>
      </div>
      <BubbleButton tone="grape" className="justify-self-center" disabled={!available} onClick={() => openAiAssistant()}>
        Ask CoachSide AI
      </BubbleButton>
    </Panel>
  );
}
