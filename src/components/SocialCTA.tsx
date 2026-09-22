import { InfoPanel, Pill } from "@/components/Bubbles";
import { SOCIAL, SOCIAL_CTA, hasSocialLinks } from "@/lib/social";

/**
 * "Tag us" prompt. The Instagram / Facebook buttons only appear once real
 * account links are configured — CoachSide never shows an invented handle.
 */
export function SocialCTA({ className }: { className?: string }) {
  return (
    <InfoPanel tone="grape" className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        <span>{SOCIAL_CTA}</span>
        {hasSocialLinks() ? (
          <span className="flex flex-wrap items-center gap-2">
            {SOCIAL.instagram ? (
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer">
                <Pill tone="flame">Instagram</Pill>
              </a>
            ) : null}
            {SOCIAL.facebook ? (
              <a href={SOCIAL.facebook} target="_blank" rel="noreferrer">
                <Pill tone="flame">Facebook</Pill>
              </a>
            ) : null}
          </span>
        ) : null}
      </div>
    </InfoPanel>
  );
}
