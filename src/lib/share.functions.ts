import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Play, PlayFrame } from "./types";

const tokenSchema = z.object({ token: z.string().min(6).max(64) });

export type SharedPlayBundle = { play: Play; frames: PlayFrame[] };

/** Token-gated read of a shared play and its frames. */
export const getSharedPlay = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data: play } = await supabaseAdmin
      .from("plays")
      .select("*")
      .eq("share_token", data.token)
      .eq("is_shared", true)
      .maybeSingle();

    if (!play) {
      // Team-scoped link: only valid while the play stays in that team's playbook.
      const { data: a } = await supabaseAdmin
        .from("play_team_assignments")
        .select("play_id")
        .eq("share_token" as never, data.token)
        .eq("share_enabled" as never, true)
        .maybeSingle();
      if (!a) return null;
      const { data: p2 } = await supabaseAdmin.from("plays").select("*").eq("id", (a as { play_id: string }).play_id).maybeSingle();
      if (!p2) return null;
      // Read-only presentation fields only; never the source team or token.
      play = { ...p2, team_id: null, share_token: data.token, is_shared: true } as typeof p2;
    }

    const { data: frames } = await supabaseAdmin
      .from("play_frames")
      .select("*")
      .eq("play_id", play.id)
      .order("idx");

    const bundle: SharedPlayBundle = {
      play: play as unknown as Play,
      frames: (frames ?? []) as unknown as PlayFrame[],
    };
    // Serialized as JSON so the transport does not need per-field serializers.
    return JSON.stringify(bundle);
  });
