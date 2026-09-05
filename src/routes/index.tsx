import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BubbleButton, Label, Panel, Pill } from "@/components/Bubbles";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import { fetchOrg, fetchProfile, fetchTeams } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CourtFlow Coach — Plays & Live Stats" },
      {
        name: "description",
        content:
          "Sign in to design basketball plays and capture live game stats from the court, with shot charts and shareable PDF reports.",
      },
      { property: "og:title", content: "CourtFlow Coach — Plays & Live Stats" },
      {
        property: "og:description",
        content: "Design plays and capture live basketball stats from the court.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["profile", user?.id], queryFn: fetchProfile, enabled: !!user });
  const org = useQuery({
    queryKey: ["org", profile.data?.org_id],
    queryFn: () => fetchOrg(profile.data!.org_id as string),
    enabled: !!profile.data?.org_id,
  });
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const inputCls =
    "w-full rounded-2xl border border-input bg-surface-2/70 px-4 py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-grape";

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { org_name: orgName || "My Program", full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created — check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center gap-2 rounded-3xl border border-border/70 bg-surface/80 p-3 shadow-lg shadow-black/30">
          <span className="rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2 text-sm font-black uppercase tracking-[0.18em] text-foreground">
            CourtFlow Coach
          </span>
          <Pill tone="flame">Plays + Live Stats</Pill>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <Pill tone="grape">{org.data?.name ?? "My Program"}</Pill>
                <Pill tone="muted">{user.email}</Pill>
                <BubbleButton size="sm" tone="neutral" onClick={() => void signOut()}>
                  Sign out
                </BubbleButton>
              </>
            ) : (
              <Pill tone="muted">{ready ? "Signed out" : "Loading"}</Pill>
            )}
          </div>
        </header>

        <Panel className="flex flex-col gap-3 p-4">
          <h1 className="inline-flex w-fit rounded-2xl border border-grape/60 bg-grape/20 px-4 py-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            One app. Two jobs.
          </h1>
          <p className="inline-flex w-fit rounded-2xl border border-border bg-surface-2/70 px-4 py-2 text-sm font-semibold text-muted-foreground">
            Draw the play in the gym. Capture every stat from the court. Share the report after.
          </p>
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          <Panel className="flex flex-col gap-3 border-grape/50 p-4">
            <Label>Section 1</Label>
            <span className="inline-flex w-fit rounded-2xl border border-grape/60 bg-grape/25 px-4 py-2 text-lg font-black text-foreground">
              Play Creation
            </span>
            <div className="flex flex-wrap gap-2">
              <Pill tone="muted">Frame by frame</Pill>
              <Pill tone="muted">Passes, cuts, screens</Pill>
              <Pill tone="muted">Share to players</Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/plays">
                <BubbleButton tone="grape">Open Playbook</BubbleButton>
              </Link>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3 border-flame/50 p-4">
            <Label>Section 2</Label>
            <span className="inline-flex w-fit rounded-2xl border border-flame/60 bg-flame/25 px-4 py-2 text-lg font-black text-foreground">
              Live Game Stat Capture
            </span>
            <div className="flex flex-wrap gap-2">
              <Pill tone="muted">Court-first entry</Pill>
              <Pill tone="muted">Free throws & team fouls</Pill>
              <Pill tone="muted">Shot maps + PDF report</Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/games">
                <BubbleButton tone="flame">Games</BubbleButton>
              </Link>
              <Link to="/games/new">
                <BubbleButton tone="neutral">Start a game</BubbleButton>
              </Link>
            </div>
          </Panel>
        </div>

        {user ? (
          <Panel className="flex flex-col gap-3 p-4">
            <Label>Your rosters</Label>
            <div className="flex flex-wrap gap-2">
              {teams.data?.map((t) => (
                <Pill key={t.id} tone="grape">
                  {t.name} · {t.season}
                </Pill>
              ))}
              {!teams.data?.length ? <Pill tone="muted">No teams yet</Pill> : null}
              <Link to="/roster">
                <BubbleButton size="sm" tone="neutral">
                  Manage rosters
                </BubbleButton>
              </Link>
            </div>
          </Panel>
        ) : (
          <Panel className="flex w-full max-w-xl flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <BubbleButton
                size="sm"
                tone={mode === "signin" ? "grape" : "neutral"}
                onClick={() => setMode("signin")}
              >
                Team sign in
              </BubbleButton>
              <BubbleButton
                size="sm"
                tone={mode === "signup" ? "flame" : "neutral"}
                onClick={() => setMode("signup")}
              >
                Create account
              </BubbleButton>
            </div>
            {mode === "signup" ? (
              <>
                <Label>Organization / school</Label>
                <input
                  className={inputCls}
                  placeholder="Aliso Niguel Athletics"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <Label>Your name</Label>
                <input
                  className={inputCls}
                  placeholder="Coach name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </>
            ) : null}
            <Label>Email</Label>
            <input
              className={inputCls}
              type="email"
              placeholder="coach@school.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Label>Password</Label>
            <input
              className={inputCls}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <BubbleButton tone={mode === "signup" ? "flame" : "grape"} disabled={busy} onClick={() => void submit()}>
                {mode === "signup" ? "Create account" : "Sign in"}
              </BubbleButton>
              <BubbleButton
                tone="ghost"
                onClick={() => navigate({ to: "/games" })}
              >
                Try the demo team
              </BubbleButton>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
