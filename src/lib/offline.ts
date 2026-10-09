// Local-first queue for live game entry.
// Events are written to IndexedDB immediately and flushed to the backend
// whenever connectivity allows. Nothing entered is lost on reload or dropout.
import { supabase } from "@/integrations/supabase/client";
import type { GameEvent, Substitution } from "./types";

const DB_NAME = "courtflow";
const DB_VERSION = 1;
const OPS = "ops";
const CACHE = "cache";

export type QueueOp =
  | { id: string; kind: "insert_event"; payload: GameEvent }
  | { id: string; kind: "delete_event"; payload: { id: string } }
  | { id: string; kind: "update_event"; payload: Partial<GameEvent> & { id: string } }
  | { id: string; kind: "insert_sub"; payload: Substitution }
  | {
      id: string;
      kind: "update_game";
      payload: { id: string } & Record<string, unknown>;
    };

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const inflight = new Set<Promise<unknown>>();

export async function enqueue(op: QueueOp) {
  const p = tx(OPS, "readwrite", (s) => s.put(op));
  inflight.add(p);
  try {
    await p;
  } finally {
    inflight.delete(p);
  }
}

/** Wait until every enqueue started so far has landed in IndexedDB. */
export async function settleEnqueues() {
  await Promise.allSettled([...inflight]);
}

let flushing: Promise<number> | null = null;

export async function pendingOps(): Promise<QueueOp[]> {
  const all = await tx<QueueOp[]>(OPS, "readonly", (s) => s.getAll());
  return all.sort((a, b) => a.id.localeCompare(b.id));
}

async function removeOp(id: string) {
  await tx(OPS, "readwrite", (s) => s.delete(id));
}

export async function cacheSet(key: string, value: unknown) {
  const db = await idb();
  await new Promise((resolve, reject) => {
    const t = db.transaction(CACHE, "readwrite");
    const req = t.objectStore(CACHE).put(value, key);
    req.onsuccess = () => resolve(null);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await idb();
  return new Promise<T | null>((resolve) => {
    const t = db.transaction(CACHE, "readonly");
    const req = t.objectStore(CACHE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

/** Flush every queued op. Returns the number still pending afterwards. */
export function flushQueue(): Promise<number> {
  // Serialize: overlapping flushes (interval + End Game) could race and skip ops.
  const run = (flushing ?? Promise.resolve(0)).catch(() => 0).then(() => flushOnce());
  flushing = run;
  void run.finally(() => {
    if (flushing === run) flushing = null;
  });
  return run;
}

/**
 * Drain the queue before finalizing: waits for pending local writes, then
 * flushes until empty, offline, or no progress is made.
 */
export async function drainQueue(maxRounds = 4): Promise<number> {
  await settleEnqueues();
  let left = await flushQueue();
  for (let i = 1; i < maxRounds && left > 0; i++) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;
    const before = left;
    await new Promise((r) => setTimeout(r, 400));
    left = await flushQueue();
    if (left >= before) break;
  }
  return left;
}

async function flushOnce(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return (await pendingOps()).length;
  }
  const ops = await pendingOps();
  for (const op of ops) {
    try {
      if (op.kind === "insert_event") {
        const { error } = await supabase.from("game_events").upsert(op.payload as never);
        if (error) throw error;
      } else if (op.kind === "delete_event") {
        const { error } = await supabase.from("game_events").delete().eq("id", op.payload.id);
        if (error) throw error;
      } else if (op.kind === "update_event") {
        const { id, ...rest } = op.payload;
        const { error } = await supabase.from("game_events").update(rest as never).eq("id", id);
        if (error) throw error;
      } else if (op.kind === "insert_sub") {
        const { error } = await supabase.from("substitutions").upsert(op.payload as never);
        if (error) throw error;
      } else if (op.kind === "update_game") {
        const { id, ...rest } = op.payload;
        const { error } = await supabase.from("games").update(rest as never).eq("id", id);
        if (error) throw error;
      }
      await removeOp(op.id);
    } catch {
      break; // keep order; retry later
    }
  }
  return (await pendingOps()).length;
}

export function opId() {
  return `${Date.now().toString().padStart(14, "0")}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
