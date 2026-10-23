import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicLibraryClient } from "./publicPlay.functions";

/** Public, text-only fields of a published drill (no owner or team ids). */
export type PublicDrillSeo = {
  id: string;
  name: string;
  category: string;
  skill_focus: string[];
  group_size: string;
  equipment: string[];
  duration_minutes: number;
  repetitions: string | null;
  instructions: string;
  coaching_points: string | null;
  scoring_rules: string | null;
  difficulty: string;
  style: string;
  published_at: string | null;
  library_author_name: string | null;
};

export const PUBLIC_DRILL_COLUMNS =
  "id, name, category, skill_focus, group_size, equipment, duration_minutes, repetitions, instructions, coaching_points, scoring_rules, difficulty, style, published_at, library_author_name";

/** Server-rendered details for one published Library drill (null = not published). */
export const getPublicDrillSeo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ drillId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicDrillSeo | null> => {
    const sb = publicLibraryClient();
    const { data: r, error } = await sb
      .from("drills")
      .select(PUBLIC_DRILL_COLUMNS)
      .eq("id", data.drillId)
      .eq("published_to_library", true)
      .maybeSingle();
    if (error) {
      console.error("public drill seo", error.message);
      return null;
    }
    if (!r) return null;
    const row = r as unknown as PublicDrillSeo;
    return {
      ...row,
      skill_focus: Array.isArray(row.skill_focus) ? row.skill_focus : [],
      equipment: Array.isArray(row.equipment) ? row.equipment : [],
    };
  });
