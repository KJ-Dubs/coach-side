import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BubbleButton, Field, Label, Note, Panel, Pill, TextInput } from "@/components/Bubbles";
import { supabase } from "@/integrations/supabase/client";
import wordmark from "@/assets/coachside-wordmark.png.asset.json";

type Mode = "signin" | "signup" | "forgot" | "reset";

/**
 * The only thing a signed-out coach sees. Email + password sign in,
 * account creation, forgot-password and the post-email password reset form.
 */
export function AuthCard({
  initialMode = "signin",
  lockSignup,
  banner,
  defaultOrgName,
  onDone,
}: {
  initialMode?: Mode;
  /** Invite flows may pre-fill and lock the program name. */
  lockSignup?: boolean;
  banner?: ReactNode;
  defaultOrgName?: string;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState(defaultOrgName ?? "");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Supabase fires PASSWORD_RECOVERY after the reset-email link lands here.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        if (password.length < 6) throw new Error("Password needs at least 6 characters");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { org_name: orgName.trim() || "My Program", full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created — welcome, Coach");
          onDone?.();
        } else {
          setNotice("Account created. Check your email to confirm, then sign in here.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onDone?.();
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
        setMode("signin");
      } else if (mode === "reset") {
        if (password.length < 6) throw new Error("Password needs at least 6 characters");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated");
        onDone?.();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create your coach account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : "Sign in to CoachSide";

  return (
    <Panel className="flex w-full max-w-md flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center overflow-hidden rounded-2xl border border-grape/60 bg-grape/20 px-3 py-2">
          <img src={wordmark.url} alt="CoachSide" className="h-7 w-auto" />
        </span>
        <Pill tone="flame">Basketball</Pill>
      </div>
      {banner}
      <h1 className="inline-flex w-fit rounded-2xl border border-border bg-surface-2/80 px-4 py-2 text-lg font-black tracking-tight text-foreground">
        {title}
      </h1>

      {mode !== "reset" ? (
        <div className="flex flex-wrap gap-2">
          <BubbleButton
            size="sm"
            tone={mode === "signin" || mode === "forgot" ? "grape" : "neutral"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </BubbleButton>
          {!lockSignup || mode === "signup" ? (
            <BubbleButton
              size="sm"
              tone={mode === "signup" ? "flame" : "neutral"}
              onClick={() => setMode("signup")}
            >
              Create account
            </BubbleButton>
          ) : (
            <BubbleButton size="sm" tone="neutral" onClick={() => setMode("signup")}>
              Create account
            </BubbleButton>
          )}
        </div>
      ) : null}

      {notice ? <Note tone="grape">{notice}</Note> : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === "signup" ? (
          <>
            <Field label="Program / school">
              <TextInput
                placeholder="Aliso Niguel Basketball"
                value={orgName}
                disabled={!!lockSignup}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </Field>
            <Field label="Your name">
              <TextInput
                placeholder="Coach name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {mode !== "reset" ? (
          <Field label="Email">
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="coach@school.org"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        ) : null}

        {mode !== "forgot" ? (
          <Field label={mode === "reset" ? "New password" : "Password"}>
            <TextInput
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              required
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <BubbleButton
            type="submit"
            size="lg"
            tone={mode === "signup" ? "flame" : "grape"}
            disabled={busy}
            className="flex-1"
          >
            {busy
              ? "One moment…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Save password"
                    : "Sign in"}
          </BubbleButton>
          {mode === "signin" ? (
            <BubbleButton size="sm" tone="ghost" onClick={() => setMode("forgot")}>
              Forgot password?
            </BubbleButton>
          ) : null}
          {mode === "forgot" ? (
            <BubbleButton size="sm" tone="ghost" onClick={() => setMode("signin")}>
              Back
            </BubbleButton>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Label>Live stats from the court</Label>
        <Label>Play designer</Label>
        <Label>Season stats & PDF reports</Label>
      </div>
    </Panel>
  );
}
