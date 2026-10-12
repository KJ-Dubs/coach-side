import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Heading, Panel } from "@/components/Bubbles";
import { saveOnboarding } from "@/lib/onboarding";

/** Lets any coach re-run the first-sign-in setup guide. */
export function RestartSetupGuide() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Panel className="flex flex-col items-center gap-3 text-center">
      <Heading className="text-center">Setup guide</Heading>
      <p className="text-sm text-muted-foreground">Walk through team setup, colors, roster and first steps again.</p>
      <BubbleButton
        tone="grape" disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await saveOnboarding({ status: "in_progress", step: 1 });
            qc.setQueryData(["onboarding"], r);
            navigate({ to: "/welcome" });
          } catch (e) { toast.error(e instanceof Error ? e.message : "Could not restart"); }
          finally { setBusy(false); }
        }}
      >Restart setup guide</BubbleButton>
    </Panel>
  );
}
