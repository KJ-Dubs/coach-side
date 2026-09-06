import { createFileRoute } from "@tanstack/react-router";

function ics(dt: string) {
  return new Date(dt).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export const Route = createFileRoute("/api/public/locker/$token/calendar")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (token.length < 6 || token.length > 64) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: team } = await supabaseAdmin
          .from("teams")
          .select("id,name,locker_enabled")
          .eq("locker_token", token)
          .maybeSingle();
        if (!team || !team.locker_enabled) return new Response("Not found", { status: 404 });

        const { data: rows } = await supabaseAdmin
          .from("team_events")
          .select("*")
          .eq("team_id", team.id)
          .order("starts_at");

        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//CoachSide//Locker Room//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${esc(team.name)} Locker Room`,
        ];
        const LABEL: Record<string, string> = {
          practice: "Practice",
          game: "Game",
          team_event: "Team Event",
          film: "Film Session",
          workout: "Workout",
          meeting: "Meeting",
          tournament: "Tournament",
          other: "Event",
        };
        for (const e of rows ?? []) {
          if (e.visibility === "coaches") continue;
          const end =
            e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 90 * 60000).toISOString();
          const type = (e.event_type ?? e.kind ?? "team_event") as string;
          const kindLabel = LABEL[type] ?? "Event";
          const summary =
            type === "game" && e.opponent
              ? `Game: ${e.home_away === "away" ? "@" : "vs"} ${e.opponent}`
              : `${kindLabel}: ${e.title}`;
          const details = [
            e.arrival_at
              ? `Arrival: ${new Date(e.arrival_at).toLocaleString("en-US", { timeStyle: "short", dateStyle: "short" })}`
              : "",
            e.uniform ? `Uniform: ${e.uniform}` : "",
            e.notes ?? "",
          ]
            .filter(Boolean)
            .join("\n");
          lines.push(
            "BEGIN:VEVENT",
            `UID:${e.id}@coachside`,
            `DTSTAMP:${ics(e.created_at ?? e.starts_at)}`,
            `DTSTART:${ics(e.starts_at)}`,
            `DTEND:${ics(end)}`,
            `SUMMARY:${esc(summary)}`,
            ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
            ...(details ? [`DESCRIPTION:${esc(details)}`] : []),
            "END:VEVENT",
          );
        }

        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
