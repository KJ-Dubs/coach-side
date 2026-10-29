import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** Safe in-app path only (notification links are app paths like /attendance/{id}). */
function safePath(link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  return link;
}

/**
 * Coach in-app inbox: "Attendance due" and other alerts. Tapping opens the
 * exact screen. Resolved attendance alerts are already marked read by the
 * database, so the count clears once attendance is completed or skipped.
 */
export function CoachNotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["my-notifications", "coach"],
    queryFn: () => fetchMyNotifications(15),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const open = useMutation({
    mutationFn: async (n: (typeof items)[number]) => {
      if (!n.read_at) await markNotificationRead(n.id);
      return n;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSettled: () => void qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn(
            "relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
            unread ? "border-flame/70 bg-flame/20 text-foreground" : "border-border bg-surface-2/70 text-muted-foreground hover:text-foreground",
          )}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unread ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-flame px-1 text-[10px] font-black text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] border-border bg-popover p-2">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
          Notifications
          {unread ? (
            <button
              type="button"
              className="rounded-full border border-border px-2 py-1 text-[10px] font-black text-foreground"
              onClick={(e) => {
                e.preventDefault();
                readAll.mutate();
              }}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((n) => {
            const path = safePath(n.link);
            return (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "mb-1 flex min-h-11 flex-col items-start gap-0.5 rounded-xl border px-3 py-2",
                  n.read_at ? "border-transparent opacity-70" : "border-flame/40 bg-flame/10",
                )}
                onSelect={() => {
                  open.mutate(n);
                  if (path) void navigate({ to: path });
                }}
              >
                <span className="text-sm font-black text-foreground">{n.title}</span>
                {n.body ? <span className="text-xs font-semibold text-muted-foreground">{n.body}</span> : null}
              </DropdownMenuItem>
            );
          })
        ) : (
          <div className="rounded-xl border border-border/70 bg-surface-2/60 px-3 py-3 text-center text-xs font-bold text-muted-foreground">
            You’re all caught up
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
