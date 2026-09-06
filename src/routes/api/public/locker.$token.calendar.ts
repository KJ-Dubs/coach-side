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
        for (const e of rows ?? []) {
          const end =
            e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 90 * 60000).toISOString();
          const kindLabel = e.kind === "game" ? "Game" : e.kind === "practice" ? "Practice" : "Team";
          lines.push(
            "BEGIN:VEVENT",
            `UID:${e.id}@coachside`,
            `DTSTAMP:${ics(e.created_at ?? e.starts_at)}`,
            `DTSTART:${ics(e.starts_at)}`,
            `DTEND:${ics(end)}`,
            `SUMMARY:${esc(`${kindLabel}: ${e.title}`)}`,
            ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
            ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
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
