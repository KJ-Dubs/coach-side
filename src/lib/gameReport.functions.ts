import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Game, GameEvent, Player } from "./types";

export type PublicGameReport = {
  game: Game;
  team: { name: string; season: string } | null;
  players: Player[];
  events: GameEvent[];
};

/** Token-scoped public read of a shared final game; always live from the event ledger. */
export const getPublicGameReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
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
    const { data: r, error } = await sb.rpc("public_game_report" as never, { _token: data.token } as never);
    if (error) {
      console.error("public_game_report", error.message);
      return null;
    }
    return r ? JSON.stringify(r) : null;
  });
