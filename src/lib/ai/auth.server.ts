/**
 * Resolves the signed-in CoachSide user for the assistant's streaming route.
 * The browser sends its normal session token; the database client returned
 * here acts as that user, so row security applies to every query.
 */
import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/lib/coachside/service";

function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    // New-format keys are opaque, not bearer JWTs.
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export async function authenticateRequest(
  request: Request,
): Promise<{ db: Db; userId: string } | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) return null;
  const db = createClient(url, key, {
    global: { fetch: supabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  }) as Db;
  const { data, error } = await db.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { db, userId: sub };
}
