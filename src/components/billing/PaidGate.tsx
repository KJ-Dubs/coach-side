import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { BubbleButton, Note, Panel, Pill } from "@/components/Bubbles";
import { COMPLETE_NAME, COMPLETE_PRICE, MODULES, hasModule, useEntitlement, type ModuleKey } from "@/lib/entitlements";
import { useCurrentTeam } from "@/lib/teamContext";
import { trackEvent } from "@/lib/funnel";

/**
 * Wraps one premium action. While enforcement is OFF (or the team has the
 * module / an active trial) the action renders untouched. Otherwise it shows
 * the benefit plus module and Complete upgrade choices. Data is never hidden.
 */
export function PaidGate({
  module,
  benefit,
  children,
  teamId: teamIdProp,
  compact,
}: {
  module: ModuleKey;
  benefit: string;
  children: ReactNode;
  teamId?: string | null;
  compact?: boolean;
}) {
  const { teamId: current } = useCurrentTeam();
  const teamId = teamIdProp ?? current;
  const e = useEntitlement(teamId);
  const locked = !e.loading && !hasModule(e, module);

  useEffect(() => {
    if (locked && !e.simulated) void trackEvent("feature_paywall_viewed", { teamId, entityId: null, once: true });
  }, [locked, teamId, e.simulated]);

  if (!locked) return <>{children}</>;
  const info = MODULES[module];
  if (compact) {
    return (
      <Link to="/membership">
        <BubbleButton size="sm" tone="neutral">
          <Lock className="h-4 w-4" aria-hidden /> {info.name}
        </BubbleButton>
      </Link>
    );
  }
  return (
    <Panel className="flex flex-col gap-2 border-flame/50 bg-flame/10">
      <Pill tone="flame" className="w-fit">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {info.name}
      </Pill>
      <Note tone="flame">{benefit}</Note>
      <div className="flex flex-wrap gap-2">
        <Link to="/membership">
          <BubbleButton size="sm" tone="flame">Unlock {info.name} — ${info.price}/mo</BubbleButton>
        </Link>
        <Link to="/membership">
          <BubbleButton size="sm" tone="grape">{COMPLETE_NAME} — ${COMPLETE_PRICE}/mo</BubbleButton>
        </Link>
      </div>
    </Panel>
  );
}
