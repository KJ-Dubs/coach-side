import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BubbleButton } from "@/components/Bubbles";
import { TeamBrandingStep } from "@/components/TeamBrandingStep";
import { EnablePushCard } from "@/components/EnablePushCard";
import { SocialCTA } from "@/components/SocialCTA";
import { TeamThemeProvider } from "@/components/TeamThemeProvider";
import { createTeam } from "@/lib/data";
import { useMe } from "@/lib/useMe";
import { useCurrentTeam } from "@/lib/teamContext";
import { currentPushState } from "@/lib/push";
import {
  INTERESTS, PRACTICE_TEAM, fetchOnboarding, firstWinOptions, parseRoster, saveOnboarding, trackOnboardingOnce,
  type Interest, type OnboardingEvent, type OnboardingRow,
} from "@/lib/onboarding";
import type { Team } from "@/lib/types";
import mark from "@/assets/coachside-mark.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/welcome")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Welcome to CoachSide — Let's get you coaching" },
      { name: "description", content: "Set up your team and tell CoachSide how you want to coach in a few quick steps." },
      { property: "og:title", content: "Welcome to CoachSide" },
      { property: "og:description", content: "A fast, guided setup for new basketball coaches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

const STEPS = 9; // 0 welcome … 8 done
const LEVELS = ["Youth", "Middle School", "High School", "Club", "College", "Adult", "Other"];
const inputCls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-base font-semibold text-foreground placeholder:text-muted-foreground focus:border-grape focus:outline-none";

function Welcome() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const current = useCurrentTeam();
  const ob = useQuery({ queryKey: ["onboarding"], queryFn: fetchOnboarding });
  const [row, setRow] = useState<OnboardingRow | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ob.isSuccess || loaded) return;
    setLoaded(true);
    const r = ob.data;
    if (r && r.status !== "in_progress") { navigate({ to: "/dashboard", replace: true }); return; }
    setRow(r);
    setStep(r?.step ?? 0);
  }, [ob.isSuccess, ob.data, loaded, navigate]);

  const team: Team | null = useMemo(
    () => (row?.team_id ? me.teams.find((t) => t.id === row.team_id) ?? null : null),
    [row?.team_id, me.teams],
  );

  const persist = async (patch: Partial<Omit<OnboardingRow, "user_id">>) => {
    const r = await saveOnboarding(patch);
    setRow(r);
    qc.setQueryData(["onboarding"], r);
    return r;
  };
  const track = async (e: OnboardingEvent, meta?: Record<string, string | number | boolean>, base?: OnboardingRow | null) => {
    const r = await trackOnboardingOnce(base ?? row, e, meta);
    if (r) { setRow(r); qc.setQueryData(["onboarding"], r); }
    return r;
  };
  const go = async (n: number, patch: Partial<Omit<OnboardingRow, "user_id">> = {}) => {
    setStep(n);
    try { await persist({ step: n, status: "in_progress", ...patch }); } catch { /* resume falls back to last saved step */ }
  };

  const start = async () => {
    setBusy(true);
    try { const r = await persist({ step: 1, status: "in_progress" }); await track("onboarding_started", {}, r); setStep(1); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start setup"); }
    finally { setBusy(false); }
  };

  const createPracticeTeam = async (): Promise<Team> => {
    const t = await createTeam({ name: PRACTICE_TEAM.name, season: "Practice", orgId: me.profile?.org_id ?? null });
    await supabase.from("teams").update({ is_practice: true } as never).eq("id", t.id);
    await supabase.from("players").insert(PRACTICE_TEAM.players.map(([jersey, name]) => ({ team_id: t.id, jersey, name, position: null })));
    await qc.invalidateQueries({ queryKey: ["teams"] });
    await qc.invalidateQueries({ queryKey: ["players"] });
    current.setTeam(t.id);
    return t;
  };

  const skip = async (explore = false) => {
    setBusy(true);
    try {
      let teamId = row?.team_id ?? null;
      if (explore && !teamId && me.teams.length === 0) teamId = (await createPracticeTeam()).id;
      const r = await persist({ status: "skipped", team_id: teamId });
      await track("onboarding_skipped", { step, explore }, r);
      navigate({ to: "/dashboard", replace: true });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not skip setup"); }
    finally { setBusy(false); }
  };

  if (!loaded) return <Shell step={0}><p className="text-center text-sm font-semibold text-muted-foreground">Loading…</p></Shell>;

  const back = step > 1 ? () => void go(step - 1) : undefined;
  const interests = row?.interests ?? [];

  return (
    <Shell step={step} onBack={back} onSkip={step > 0 && step < 8 ? () => void skip() : undefined} themeTeamId={team?.id}>
      {step === 0 ? (
        <Center>
          <img src={mark.url} alt="CoachSide" className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">WELCOME TO COACHSIDE</h1>
          <p className="text-xl font-black text-grape-bright">Let's get you coaching.</p>
          <p className="max-w-sm text-base text-muted-foreground">Set up your team and tell us how you want to use CoachSide. We'll get the right tools ready for you.</p>
          <BubbleButton tone="grape" size="lg" className="w-full max-w-xs justify-center" disabled={busy} onClick={() => void start()}>Get Started</BubbleButton>
          <BubbleButton tone="ghost" disabled={busy} onClick={() => void skip(true)}>Explore first</BubbleButton>
        </Center>
      ) : null}

      {step === 1 ? (
        <InterestsStep
          initial={interests}
          onContinue={async (list) => {
            const r = await persist({ interests: list, step: 2 });
            await track("onboarding_interests_saved", { count: list.length, picks: list.join(",") }, r);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <TeamStep
          teams={me.teams}
          onUseExisting={async (t) => { current.setTeam(t.id); await go(3, { team_id: t.id }); }}
          onCreate={async (name, season, level) => {
            const t = await createTeam({ name, season, orgId: me.profile?.org_id ?? null });
            if (level) await supabase.from("teams").update({ level } as never).eq("id", t.id);
            await qc.invalidateQueries({ queryKey: ["teams"] });
            current.setTeam(t.id);
            const r = await persist({ team_id: t.id, step: 3 });
            await track("onboarding_team_created", { practice: false }, r);
            setStep(3);
          }}
          onPractice={async () => {
            const t = await createPracticeTeam();
            const r = await persist({ team_id: t.id, step: 3, players_added: PRACTICE_TEAM.players.length });
            await track("onboarding_team_created", { practice: true }, r);
            setStep(3);
          }}
        />
      ) : null}

      {step === 3 ? (
        team ? (
          <div className="flex flex-col gap-3">
            <TeamBrandingStep
              team={team}
              onDone={async () => {
                const fresh = (qc.getQueryData<Team[]>(["teams"]) ?? []).find((t) => t.id === team.id);
                const set = !!(fresh?.primary_color || fresh?.secondary_color);
                const r = await persist({ colors_set: set, step: 4 });
                await track("onboarding_branding_completed", { colors: set }, r);
                setStep(4);
              }}
            />
          </div>
        ) : <Center><p className="text-muted-foreground">Create a team first.</p><BubbleButton tone="grape" onClick={() => void go(2)}>Set up team</BubbleButton></Center>
      ) : null}

      {step === 4 ? (
        <RosterStep
          team={team}
          onSaved={async (n) => {
            const r = await persist({ players_added: (row?.players_added ?? 0) + n, step: 5 });
            if (n > 0) await track("onboarding_roster_added", { players: n }, r);
            setStep(5);
            void qc.invalidateQueries({ queryKey: ["players"] });
          }}
        />
      ) : null}

      {step === 5 ? (
        <FirstWinStep
          interests={interests}
          onPick={async (key, link) => {
            await track("onboarding_first_action_selected", { action: key });
            await persist({ step: 6 });
            sessionStorage.setItem("coachside.onboarding.firstAction", link);
            setStep(6);
          }}
        />
      ) : null}

      {step === 6 ? (
        <NotifyStep
          onShown={() => void track("onboarding_push_prompted")}
          onContinue={async () => {
            if ((await currentPushState().catch(() => null)) === "on") await track("onboarding_push_enabled");
            await go(7);
          }}
        />
      ) : null}

      {step === 7 ? (
        <Center>
          <Title>Get more from CoachSide</Title>
          <p className="max-w-sm text-base text-muted-foreground">Follow CoachSide for plays, coaching ideas, and new features.</p>
          <div className="w-full" onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) void track("onboarding_social_opened"); }}>
            <SocialCTA />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">Publish your plays to the CoachSide Library and your play could be featured on our social accounts.</p>
          <BubbleButton tone="grape" size="lg" className="w-full max-w-xs justify-center" onClick={() => void go(8)}>Continue</BubbleButton>
          <BubbleButton tone="ghost" onClick={() => void go(8)}>Publish later</BubbleButton>
        </Center>
      ) : null}

      {step === 8 ? (
        <Center>
          <Title>You're ready to coach.</Title>
          <ul className="flex w-full max-w-sm flex-col gap-2 text-left">
            <Recap ok={!!team} label={team ? `${team.name}${team.is_practice ? " (practice)" : ""}` : "No team yet"} />
            <Recap ok={!!row?.colors_set} label={row?.colors_set ? "Team colors set" : "CoachSide colors"} />
            <Recap ok={(row?.players_added ?? 0) > 0} label={`${row?.players_added ?? 0} players added`} />
            <Recap ok={interests.length > 0} label={interests.length ? INTERESTS.filter((i) => interests.includes(i.key)).map((i) => i.title).join(" · ") : "No interests picked"} />
          </ul>
          {(() => {
            const primary = firstWinOptions(interests)[0];
            const link = sessionStorage.getItem("coachside.onboarding.firstAction") || (team ? primary.link : "/roster");
            const label = team ? primary.cta : "Create Team";
            return (
              <BubbleButton
                tone="grape" size="lg" className="w-full max-w-xs justify-center" disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await persist({ status: "completed", step: 8 });
                    await track("onboarding_completed", { players: r.players_added, colors: r.colors_set }, r);
                    sessionStorage.removeItem("coachside.onboarding.firstAction");
                    router.history.replace(link);
                  } finally { setBusy(false); }
                }}
              >{label}</BubbleButton>
            );
          })()}
        </Center>
      ) : null}
    </Shell>
  );
}

function Shell({ step, children, onBack, onSkip, themeTeamId }: { step: number; children: React.ReactNode; onBack?: (() => void) | undefined; onSkip?: (() => void) | undefined; themeTeamId?: string | undefined }) {
  return (
    <div className="min-h-dvh bg-background px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      {themeTeamId ? <TeamThemeProvider teamId={themeTeamId} /> : null}
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center gap-2">
          <div className="w-20">{onBack ? <BubbleButton size="sm" tone="ghost" onClick={onBack}>Back</BubbleButton> : null}</div>
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label="Setup progress">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-grape" : "bg-border"}`} />
            ))}
          </div>
          <div className="flex w-20 justify-end">{onSkip ? <BubbleButton size="sm" tone="ghost" onClick={onSkip}>Skip setup</BubbleButton> : null}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-4 pt-6 text-center">{children}</div>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{children}</h1>;
}
function Recap({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${ok ? "bg-grape text-primary-foreground" : "bg-border text-muted-foreground"}`}><Check className="h-4 w-4" /></span>
      {label}
    </li>
  );
}

function InterestsStep({ initial, onContinue }: { initial: Interest[]; onContinue: (l: Interest[]) => Promise<void> }) {
  const [sel, setSel] = useState<Interest[]>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center"><Title>What do you want CoachSide to help with?</Title><p className="mt-1 text-sm text-muted-foreground">Pick any. You'll still have every tool.</p></div>
      {INTERESTS.map((i) => {
        const on = sel.includes(i.key);
        return (
          <button
            key={i.key} type="button" aria-pressed={on}
            onClick={() => setSel((s) => (on ? s.filter((x) => x !== i.key) : [...s, i.key]))}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? "border-grape bg-grape/15" : "border-border bg-surface hover:border-grape/50"}`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${on ? "border-grape bg-grape text-primary-foreground" : "border-border"}`}>{on ? <Check className="h-4 w-4" /> : null}</span>
            <span><span className="block text-base font-black text-foreground">{i.title}</span><span className="block text-sm text-muted-foreground">{i.body}</span></span>
          </button>
        );
      })}
      <BubbleButton tone="grape" size="lg" className="justify-center" disabled={busy} onClick={async () => { setBusy(true); try { await onContinue(sel); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); } }}>Continue</BubbleButton>
    </div>
  );
}

function TeamStep({ teams, onCreate, onPractice, onUseExisting }: {
  teams: Team[]; onCreate: (n: string, s: string, l: string) => Promise<void>; onPractice: () => Promise<void>; onUseExisting: (t: Team) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [season, setSeason] = useState("2025-26");
  const [level, setLevel] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create team"); } finally { setBusy(false); } };
  return (
    <div className="flex flex-col gap-4">
      <Title><span className="block text-center">What's your team name?</span></Title>
      {teams.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
          <p className="text-center text-sm font-semibold text-muted-foreground">You already have a team</p>
          {teams.map((t) => <BubbleButton key={t.id} tone="neutral" className="justify-center" disabled={busy} onClick={() => void run(() => onUseExisting(t))}>Use {t.name}</BubbleButton>)}
        </div>
      ) : null}
      <input className={inputCls} placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Team name" />
      <input className={inputCls} placeholder="Season" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season" />
      <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level (optional)">
        <option value="">Level (optional)</option>
        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <BubbleButton tone="grape" size="lg" className="justify-center" disabled={busy || !name.trim()} onClick={() => void run(() => onCreate(name.trim(), season.trim() || "2025-26", level))}>Create Team</BubbleButton>
      <BubbleButton tone="ghost" className="justify-center" disabled={busy} onClick={() => void run(onPractice)}>Use a Practice Team</BubbleButton>
      <p className="text-center text-xs text-muted-foreground">Practice Team adds "East High Varsity (Practice)" with clearly labeled sample players. Rename or delete it anytime.</p>
    </div>
  );
}

type Row = { jersey: string; first: string; last: string };
function RosterStep({ team, onSaved }: { team: Team | null; onSaved: (n: number) => Promise<void> }) {
  const [mode, setMode] = useState<"choose" | "rows" | "paste">("choose");
  const [rows, setRows] = useState<Row[]>([{ jersey: "", first: "", last: "" }]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const players = useQuery({
    queryKey: ["onboarding-players", team?.id],
    queryFn: async () => (await supabase.from("players").select("jersey,name").eq("team_id", team!.id).order("jersey")).data ?? [],
    enabled: !!team,
  });
  const save = async (list: Row[]) => {
    const clean = list.filter((r) => r.first.trim());
    if (!team) return onSaved(0);
    setBusy(true);
    try {
      if (clean.length) {
        const { error } = await supabase.from("players").insert(clean.map((r) => ({ team_id: team.id, jersey: r.jersey.trim(), name: `${r.first.trim()} ${r.last.trim()}`.trim(), position: null })));
        if (error) throw error;
      }
      await onSaved(clean.length);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save roster"); }
    finally { setBusy(false); }
  };
  const parsed = parseRoster(paste);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center"><Title>Add your players</Title><p className="mt-1 text-sm text-muted-foreground">You can add your roster now or come back later.</p></div>
      {team?.is_practice ? (
        <>
          <ul className="grid grid-cols-2 gap-2">
            {(players.data ?? []).map((p, i) => <li key={i} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground">#{p.jersey} {p.name}</li>)}
          </ul>
          <p className="text-center text-xs text-muted-foreground">Sample players — just for trying things out.</p>
          <BubbleButton tone="grape" size="lg" className="justify-center" onClick={() => void onSaved(0)}>Continue</BubbleButton>
        </>
      ) : mode === "choose" ? (
        <>
          <BubbleButton tone="grape" size="lg" className="justify-center" onClick={() => setMode("rows")}>Add Players</BubbleButton>
          <BubbleButton tone="neutral" size="lg" className="justify-center" onClick={() => setMode("paste")}>Paste Roster</BubbleButton>
          <BubbleButton tone="ghost" className="justify-center" onClick={() => void onSaved(0)}>Skip for now</BubbleButton>
        </>
      ) : mode === "rows" ? (
        <>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[4rem_1fr_1fr] gap-2">
              {(["jersey", "first", "last"] as const).map((k) => (
                <input key={k} className={inputCls} inputMode={k === "jersey" ? "numeric" : undefined} placeholder={k === "jersey" ? "#" : k === "first" ? "First" : "Last"} aria-label={k}
                  value={r[k]} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
              ))}
            </div>
          ))}
          <BubbleButton tone="ghost" className="justify-center" onClick={() => setRows((rs) => [...rs, { jersey: "", first: "", last: "" }])}>+ Add another row</BubbleButton>
          <BubbleButton tone="grape" size="lg" className="justify-center" disabled={busy || !rows.some((r) => r.first.trim())} onClick={() => void save(rows)}>Save roster</BubbleButton>
          <BubbleButton tone="ghost" className="justify-center" onClick={() => setMode("choose")}>Back to options</BubbleButton>
        </>
      ) : (
        <>
          <textarea className={`${inputCls} h-40 py-2`} placeholder={"4 John Smith\n12 Mike Jones"} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Paste roster" />
          {parsed.length ? (
            <ul className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-sm font-semibold text-foreground">
              {parsed.map((p, i) => <li key={i}>#{p.jersey || "—"} {p.first} {p.last}</li>)}
            </ul>
          ) : null}
          <BubbleButton tone="grape" size="lg" className="justify-center" disabled={busy || !parsed.length} onClick={() => void save(parsed)}>Save {parsed.length || ""} players</BubbleButton>
          <BubbleButton tone="ghost" className="justify-center" onClick={() => setMode("choose")}>Back to options</BubbleButton>
        </>
      )}
    </div>
  );
}

function FirstWinStep({ interests, onPick }: { interests: Interest[]; onPick: (key: string, link: string) => Promise<void> }) {
  const [main, ...alts] = firstWinOptions(interests);
  const plays = main.key === "plays";
  return (
    <Center>
      <Title>{main.title}</Title>
      <p className="max-w-sm text-base text-muted-foreground">{main.body}</p>
      <BubbleButton tone="grape" size="lg" className="w-full max-w-xs justify-center" onClick={() => void onPick(main.key, main.link)}>{main.cta}</BubbleButton>
      {plays ? <BubbleButton tone="neutral" onClick={() => void onPick("build_play", "/plays/new")}>Build a Play</BubbleButton> : null}
      {alts.length ? (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {alts.map((a) => <BubbleButton key={a.key} size="sm" tone="ghost" onClick={() => void onPick(a.key, a.link)}>{a.cta}</BubbleButton>)}
        </div>
      ) : null}
      <BubbleButton size="sm" tone="ghost" onClick={() => void onPick("later", "/dashboard")}>Decide later</BubbleButton>
    </Center>
  );
}

function NotifyStep({ onShown, onContinue }: { onShown: () => void; onContinue: () => Promise<void> }) {
  const [prefs, setPrefs] = useState({ team: true, potd: true, news: false });
  useEffect(() => { onShown(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const savePrefs = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const patch = {
      announcement_notifications: prefs.team, schedule_change_notifications: prefs.team, assignment_notifications: prefs.team,
      play_of_the_day_notifications: prefs.potd, onboarding_tips: prefs.news,
    };
    const { data } = await supabase.from("notification_preferences").select("id").eq("user_id", u.user.id).maybeSingle();
    if (data) await supabase.from("notification_preferences").update(patch).eq("user_id", u.user.id);
    else await supabase.from("notification_preferences").insert({ user_id: u.user.id, ...patch });
  };
  const items: [keyof typeof prefs, string][] = [["team", "Team messages, schedule & Plans"], ["potd", "Play of the Day"], ["news", "New CoachSide features"]];
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center"><Title>Stay ready</Title><p className="mt-1 text-sm text-muted-foreground">Get Play of the Day, team messages and schedule changes, Plans, and new CoachSide features — only what you choose.</p></div>
      <EnablePushCard />
      <div className="flex flex-col gap-2">
        {items.map(([k, label]) => (
          <label key={k} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground">
            {label}
            <input type="checkbox" className="h-5 w-5 accent-[var(--grape)]" checked={prefs[k]} onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))} />
          </label>
        ))}
      </div>
      <BubbleButton tone="grape" size="lg" className="justify-center" onClick={async () => { await savePrefs().catch(() => undefined); await onContinue(); }}>Continue</BubbleButton>
      <BubbleButton tone="ghost" className="justify-center" onClick={() => void onContinue()}>Not now</BubbleButton>
    </div>
  );
}
