import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BubbleButton } from "@/components/Bubbles";
import { useAuth } from "@/lib/auth";
import { notifyProgressChanged } from "@/lib/activity";
import { fetchMyFollowedCreators, setFollowCreator } from "@/lib/community";

/** Follow a public CoachSide creator. Signed-out visitors are sent to sign in. */
export function FollowButton({ username, size = "sm", named = false, className }: { username: string; size?: "sm" | "md"; named?: boolean; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const follows = useQuery({
    queryKey: ["my-follows"],
    queryFn: fetchMyFollowedCreators,
    enabled: !!user,
  });
  const following = (follows.data ?? []).some((c) => c.username === username);

  const toggle = useMutation({
    mutationFn: () => setFollowCreator(username, !following),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-follows"] });
      notifyProgressChanged();
      void qc.invalidateQueries({ queryKey: ["creator-profile", username] });
      toast.success(following ? `Unfollowed @${username}` : `Following @${username}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <Link to="/auth" className="inline-flex">
        <BubbleButton size={size} tone="ghost">
          Sign in to follow
        </BubbleButton>
      </Link>
    );
  }

  return (
    <BubbleButton
      size={size}
      tone={following ? "neutral" : "grape"}
      disabled={toggle.isPending}
      aria-pressed={following}
      className={className}
      onClick={() => toggle.mutate()}
    >
      {named ? (following ? `Unfollow @${username}` : `+ Follow @${username}`) : following ? "✓ Following" : "+ Follow"}
    </BubbleButton>
  );
}
