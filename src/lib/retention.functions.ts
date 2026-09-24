import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACHIEVEMENTS } from "./achievements";

export type AchievementProgress = {
  key: string;
  value: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type MyProgress = {
  metrics: Record<string, number>;
  items: AchievementProgress[];
  unlockedCount: number;
  total: number;
  newlyUnlocked: string[];
};

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/**
 * Measures the coach's progress from real data, records new unlocks and tells
 * them in-app (push only for major milestones). Also keeps the daily
 * Play of the Day and onboarding messages current. Safe to call on every visit.
 */
export const syncMyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProgress> => {
    const { data, error } = await (context.supabase as unknown as Rpc).rpc("my_achievement_metrics");
    if (error) throw new Error("Could not load your progress.");
    const metrics = Object.fromEntries(
      Object.entries((data ?? {}) as Record<string, number | string>).map(([k, v]) => [k, Number(v) || 0]),
    );
    const { adminDb, dispatchNotification } = await import("./notify.server");
    const db = await adminDb();
    const { data: rows } = await db.from("user_achievements").select("achievement_key, unlocked_at").eq("user_id", context.userId);
    const have = new Map(((rows ?? []) as { achievement_key: string; unlocked_at: string }[]).map((r) => [r.achievement_key, r.unlocked_at]));

    const newly = ACHIEVEMENTS.filter((a) => (metrics[a.metric] ?? 0) >= a.target && !have.has(a.key));
    if (newly.length) {
      const now = new Date().toISOString();
      await db.from("user_achievements").upsert(
        newly.map((a) => ({ user_id: context.userId, achievement_key: a.key, unlocked_at: now })),
        { onConflict: "user_id,achievement_key", ignoreDuplicates: true },
      );
      for (const a of newly) {
        have.set(a.key, now);
        await dispatchNotification({
          audience: { kind: "users", userIds: [context.userId] },
          type: "achievement",
          title: `Achievement unlocked: ${a.name}`,
          body: a.description,
          link: "/achievements",
          dedupeKey: `ach:${context.userId}:${a.key}`,
          channels: a.major ? ["inapp", "push"] : ["inapp"],
        });
      }
      const activated = ["team_1", "roster_5", "plays_1", "library_1", "game_1"].every((k) => have.has(k));
      if (activated && newly.some((a) => ["team_1", "roster_5", "plays_1", "library_1", "game_1"].includes(a.key))) {
        await db.from("product_activity_events").insert({ user_id: context.userId, event_type: "activation_completed" });
      }
    }

    try {
      const { ensurePlayOfTheDay, runNurtureForUser } = await import("./retention.server");
      await ensurePlayOfTheDay();
      await runNurtureForUser(context.userId, metrics);
    } catch (e) {
      console.error("daily retention jobs", e);
    }

    const items = ACHIEVEMENTS.map((a) => ({
      key: a.key,
      value: metrics[a.metric] ?? 0,
      unlocked: have.has(a.key),
      unlockedAt: have.get(a.key) ?? null,
    }));
    return {
      metrics,
      items,
      unlockedCount: items.filter((i) => i.unlocked).length,
      total: items.length,
      newlyUnlocked: newly.map((a) => a.key),
    };
  });
