/**
 * CoachSide social accounts. The buttons only ever render when a real URL is
 * set here — CoachSide never invents a handle.
 */
export const SOCIAL = {
  instagram: "",
  facebook: "",
} as const;

export const SOCIAL_CTA = "Tag us in your CoachSide.live plays.";

export function hasSocialLinks() {
  return !!SOCIAL.instagram || !!SOCIAL.facebook;
}
