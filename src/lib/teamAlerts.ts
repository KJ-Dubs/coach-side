/**
 * Fire-and-forget team alerts.
 *
 * The in-app notification list is still filled by the existing database
 * triggers; this only adds the device/email channels. It never throws, so a
 * coach's post always succeeds even if alerts can't go out.
 */
import { notifyTeamEvent } from "./notifications.functions";

export function alertTeam(input: {
  teamId: string;
  kind: "announcement" | "assignment" | "play" | "schedule" | "game";
  title: string;
  body: string;
  link?: string;
  relatedId?: string;
}): void {
  void notifyTeamEvent({ data: input }).catch(() => undefined);
}
