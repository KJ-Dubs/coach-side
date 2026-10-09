import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton, Pill } from "@/components/Bubbles";

const urlFor = (token: string) => `${window.location.origin}/game-report/${token}`;

/** Coach-only share control for a completed game. Server enforces coach + final. */
export function ShareGameButton({ gameId, size = "sm" }: { gameId: string; size?: "sm" | "md" | "lg" }) {
  const qc = useQueryClient();
  const key = ["game-share", gameId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await supabase.from("game_share_links").select("token").eq("game_id", gameId).maybeSingle()).data?.token as
        | string
        | undefined) ?? null,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  const act = async (action: "ensure" | "rotate" | "revoke") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("set_game_share", { _game: gameId, _action: action });
      if (error) throw error;
      const token = (data as string | null) ?? null;
      qc.setQueryData(key, token);
      return token;
    } catch {
      toast.error("Couldn't update the share link");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copy = async (token: string) => {
    const url = urlFor(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Game report link copied");
    } catch {
      toast.message(url);
    }
  };

  const share = async () => {
    const token = q.data ?? (await act("ensure"));
    if (!token) return;
    await copy(token);
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      navigator.share({ title: "Game Report — CoachSide", url: urlFor(token) }).catch(() => {});
    }
  };

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1.5">
      <BubbleButton size={size} tone="grape" disabled={busy} onClick={() => void share()}>
        Share Game
      </BubbleButton>
      {q.data ? (
        <>
          <Pill tone="success">Link on</Pill>
          <BubbleButton size="sm" tone="neutral" aria-label="Share link options" className="min-h-11 min-w-11" onClick={() => setOpen((o) => !o)}>
            •••
          </BubbleButton>
        </>
      ) : null}
      {open && q.data ? (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-52 flex-col gap-1 rounded-2xl border border-border bg-surface p-1.5 shadow-lg">
          <BubbleButton size="sm" tone="neutral" onClick={() => { setOpen(false); void copy(q.data!); }}>Copy link</BubbleButton>
          <BubbleButton size="sm" tone="neutral" onClick={() => { setOpen(false); window.open(urlFor(q.data!), "_blank", "noopener"); }}>Open shared report</BubbleButton>
          <BubbleButton size="sm" tone="neutral" disabled={busy} onClick={async () => { setOpen(false); const t = await act("rotate"); if (t) { await copy(t); toast.success("Old link turned off"); } }}>Replace link</BubbleButton>
          <BubbleButton size="sm" tone="flame" disabled={busy} onClick={async () => { setOpen(false); if (!confirm("Turn off sharing? The current link will stop working.")) return; await act("revoke"); toast.success("Sharing turned off"); }}>Turn off sharing</BubbleButton>
        </div>
      ) : null}
    </div>
  );
}
