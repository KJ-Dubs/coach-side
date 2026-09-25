import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { fetchMyDrillHearts, toggleDrillHeart, type Drill } from "@/lib/drills";

/** Heart a published drill once per coach account. Signed out shows the count. */
export function DrillHeartButton({ drill, size = "sm" }: { drill: Drill; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hearts = useQuery({ 
    queryKey: ["my-drill-hearts"], 
    queryFn: fetchMyDrillHearts, 
    enabled: !!user 
  });
  
  const hearted = (hearts.data ?? []).includes(drill.id);

  const toggle = useMutation({
    mutationFn: () => toggleDrillHeart(drill.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-drill-hearts"] });
      void qc.invalidateQueries({ queryKey: ["drill-library"] });
      void qc.invalidateQueries({ queryKey: ["drill", drill.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <Link to="/auth" className="inline-flex">
        <BubbleButton size={size} tone="ghost" aria-label="{`${drill.hearts} hearts — sign in to heart`}">
          ♡ {drill.hearts} · Sign in
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
      aria-label={hearted ? "Remove heart" : "Heart this drill"}
      onClick={() => toggle.mutate()}
    >
      {hearted ? "♥" : "♡"} {drill.hearts}
    </BubbleButton>
  );
}
