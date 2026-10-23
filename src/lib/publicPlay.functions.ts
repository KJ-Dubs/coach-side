import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type PublicPlaySeo = {
  id: string;
  name: string;
  category: string;
  author_label: string;
  creator_username: string | null;
  published_at: string | null;
  situation: string | null;
  defense_faced: string | null;
  outcome: string | null;
  concepts: string[];
  defenses: string[];
  outcomes: string[];
  primary_actions: string[];
  tags: string[];
};

/** Session-free public client; reads only what the anon-granted library RPC returns. */
export function publicLibraryClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const str = (v: unknown) => (v == null ? null : String(v));

/** Server-rendered search details for one published Library play (null = not published). */
export const getPublicPlaySeo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ playId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicPlaySeo | null> => {
    const sb = publicLibraryClient();
    const { data: r, error } = await sb
      .rpc("library_feed" as never, { _creator: null } as never)
      .eq("id", data.playId)
      .maybeSingle();
    if (error) {
      console.error("library_feed seo", error.message);
      return null;
    }
    if (!r) return null;
    const row = r as Record<string, unknown>;
    return {
      id: String(row["id"]),
      name: String(row["name"] ?? "Play"),
      category: String(row["category"] ?? "Offense"),
      author_label: String(row["author_label"] ?? "CoachSide coach"),
      creator_username: str(row["creator_username"]),
      published_at: str(row["published_at"]),
      situation: str(row["situation"]),
      defense_faced: str(row["defense_faced"]),
      outcome: str(row["outcome"]),
      concepts: arr(row["concepts"]),
      defenses: arr(row["defenses"]),
      outcomes: arr(row["outcomes"]),
      primary_actions: arr(row["primary_actions"]),
      tags: arr(row["tags"]),
    };
  });
