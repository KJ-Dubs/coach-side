import { Link } from "@tanstack/react-router";
import { BubbleButton, Note, Panel, Pill } from "@/components/Bubbles";
import { COMPLETE_NAME, COMPLETE_PRICE, trialMessage, useEntitlement } from "@/lib/entitlements";

/** Small, unobtrusive trial status. Hidden when no trial applies. */
export function TrialStatus({ teamId }: { teamId: string | null }) {
  const e = useEntitlement(teamId);
  if (e.loading || e.trialDaysLeft === null) return null;
  const paid = ["active", "grace", "past_due", "complimentary"].includes(e.status) || e.complimentary;
  if (paid && !e.simulated) return null;
  const msg = trialMessage(e.trialDaysLeft, e.trialExpired);
  return (
    <Panel className="mb-3 flex flex-wrap items-center gap-2 border-grape/50">
      <Pill tone={e.trialExpired ? "danger" : "grape"}>
        {e.trialExpired
          ? "Complete trial ended"
          : `${COMPLETE_NAME} Trial • ${e.trialDaysLeft} day${e.trialDaysLeft === 1 ? "" : "s"} left`}
      </Pill>
      {msg ? <Note>{msg}</Note> : null}
      <Link to="/membership" className="ml-auto">
        <BubbleButton size="sm" tone="flame">
          Keep Complete for ${COMPLETE_PRICE}/month
        </BubbleButton>
      </Link>
    </Panel>
  );
}
