import { Link } from "@tanstack/react-router";
import { BubbleButton, Label, Note, Panel, Pill } from "@/components/Bubbles";
import {
  ALL_MODULES,
  COMPLETE_NAME,
  COMPLETE_PRICE,
  MODULES,
  hasModule,
  useEntitlement,
  type ModuleKey,
} from "@/lib/entitlements";

/**
 * Contextual membership prompt. It explains the exact benefit of one module
 * and cross-sells Complete. While enforcement is off it renders nothing, so no
 * existing workflow is interrupted.
 */
export function UpgradePrompt({
  module,
  teamId,
  headline,
}: {
  module: ModuleKey;
  teamId: string | null;
  headline: string;
}) {
  const entitlement = useEntitlement(teamId);
  if (entitlement.loading || hasModule(entitlement, module)) return null;
  const info = MODULES[module];
  const others = ALL_MODULES.filter((m) => m !== module).map((m) => MODULES[m].name);

  return (
    <Panel className="flex flex-col gap-2 border-flame/50 bg-flame/10">
      <Label>{info.name}</Label>
      <span className="rounded-2xl border border-flame/60 bg-flame/15 px-3 py-2 text-lg font-black leading-tight text-foreground">
        {headline}
      </span>
      <div className="flex flex-wrap gap-2">
        <Pill tone="flame">
          Unlock {info.name} — ${info.price}/month
        </Pill>
        <Pill tone="grape">
          {COMPLETE_NAME} — ${COMPLETE_PRICE}/month
        </Pill>
      </div>
      <Note>Also in Complete: {others.join(" and ")}. One monthly charge for this team.</Note>
      <Link to="/membership" className="w-fit">
        <BubbleButton tone="flame">See membership options</BubbleButton>
      </Link>
    </Panel>
  );
}

/**
 * Inline one-line version for tight spots (card footers, toolbars).
 */
export function UpgradeHint({ module, teamId }: { module: ModuleKey; teamId: string | null }) {
  const entitlement = useEntitlement(teamId);
  if (entitlement.loading || hasModule(entitlement, module)) return null;
  const info = MODULES[module];
  return (
    <Link to="/membership">
      <Pill tone="flame">
        {info.name} ${info.price}/mo
      </Pill>
    </Link>
  );
}
