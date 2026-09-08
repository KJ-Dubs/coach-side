import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Heading, Note, Panel } from "@/components/Bubbles";
import {
  fetchNotificationPrefs,
  PREF_LABELS,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications";

/** Email + alert switches. Coaches and players both use this. */
export function NotificationPrefsPanel() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["notification-prefs"], queryFn: fetchNotificationPrefs });

  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => updateNotificationPrefs(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = prefs.data;

  return (
    <Panel className="flex flex-col gap-3">
      <Heading tone="grape">Notifications</Heading>
      <Note>
        Choose what CoachSide tells you about. Alerts show up here in the app and are queued for
        email as soon as team email sending is switched on.
      </Note>
      {!p ? (
        <EmptyState>Loading your notification settings…</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-2">
          {PREF_LABELS.map(({ key, label }) => {
            const on = Boolean(p[key]);
            return (
              <button
                key={key}
                type="button"
                onClick={() => save.mutate({ [key]: !on } as Partial<NotificationPrefs>)}
                className={
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-black uppercase transition-colors " +
                  (on
                    ? "border-grape/60 bg-grape/25 text-foreground"
                    : "border-border bg-surface-2/70 text-muted-foreground")
                }
              >
                <span
                  className={
                    "inline-flex h-4 w-4 items-center justify-center rounded-md border " +
                    (on ? "border-grape bg-grape text-primary-foreground" : "border-border bg-surface")
                  }
                >
                  {on ? "✓" : ""}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
