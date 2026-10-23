/**
 * Client-side owner gate for My KPI drilldowns. This is only the screen:
 * every owner server function re-checks is_app_admin before reading data.
 */
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { BubbleButton, EmptyState, InfoPanel, Panel, PrimaryCTA } from "@/components/Bubbles";
import { amIAppAdmin } from "@/lib/kpi.functions";
import { useAuth } from "@/lib/auth";

export function useOwnerCheck() {
  const { user } = useAuth();
  const check = useServerFn(amIAppAdmin);
  const q = useQuery({
    queryKey: ["am-i-app-admin", user?.id ?? "signed-out"],
    queryFn: () => check(),
    enabled: !!user,
    staleTime: 300_000,
  });
  return { user, isAdmin: q.data === true, loading: !user || q.isLoading, fetched: q.isFetched };
}

export function OwnerGate({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { isAdmin, loading, fetched } = useOwnerCheck();

  useEffect(() => {
    if (!loading && fetched && !isAdmin) void navigate({ to: "/dashboard", replace: true });
  }, [loading, fetched, isAdmin, navigate]);

  if (loading) {
    return (
      <AppShell title={title} subtitle="Checking access…">
        <Panel>
          <EmptyState>Loading…</EmptyState>
        </Panel>
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell title={title} subtitle="This page is for CoachSide owners only.">
        <Panel className="flex flex-col items-center gap-3">
          <InfoPanel tone="danger">You do not have access to this page. No information is shown here.</InfoPanel>
          <PrimaryCTA>
            <BubbleButton tone="grape" onClick={() => navigate({ to: "/dashboard", replace: true })}>
              Back to dashboard
            </BubbleButton>
          </PrimaryCTA>
        </Panel>
      </AppShell>
    );
  }
  return <>{children}</>;
}
