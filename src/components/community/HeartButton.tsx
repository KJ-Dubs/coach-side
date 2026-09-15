import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { fetchMyHearts, togglePlayHeart, type LibraryPlay } from "@/lib/community";

/** Heart a published play once per coach account. Signed out shows the count. */
export function HeartButton({ play, size = "sm" }: { play: LibraryPlay; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hearts = useQuery({ queryKey: ["my-hearts"], queryFn: fetchMyHearts, enabled: !!user });
  const hearted = (hearts.data ?? []).includes(play.id);

  const toggle = useMutation({
    mutationFn: () => togglePlayHeart(play.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-hearts"] });
      void qc.invalidateQueries({ queryKey: ["library-feed"] });
      void qc.invalidateQueries({ queryKey: ["play-of-the-day"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <Link to="/auth" className="inline-flex">
        <BubbleButton size={size} tone="ghost" aria-label={`${play.hearts} hearts — sign in to heart`}>
          ♡ {play.hearts} · Sign in
        </BubbleButton>
      </Link>
    );
  }

  return (
    <BubbleButton
      size={size}
      tone={hearted ? "flame" : "ghost"}
      disabled={toggle.isPending}
      aria-pressed={hearted}
      aria-label={hearted ? "Remove heart" : "Heart this play"}
      onClick={() => toggle.mutate()}
    >
      {hearted ? "♥" : "♡"} {play.hearts}
    </BubbleButton>
  );
}
