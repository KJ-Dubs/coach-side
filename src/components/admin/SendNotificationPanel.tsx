/**
 * Owner-only "Send Notification".
 *
 * The page only renders this for owners, and every server call re-checks the
 * owner list, so a coach who guesses the endpoint is refused by the backend.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BubbleButton,
  EmptyState,
  Field,
  Heading,
  InfoPanel,
  Label,
  Note,
  Panel,
  Pill,
  PrimaryCTA,
  SelectInput,
  StatTile,
  TextInput,
} from "@/components/Bubbles";
import {
  getBroadcastContext,
  getNotificationKpis,
  sendBroadcast,
} from "@/lib/notifications.admin.functions";

type AudienceKind = "all_coaches" | "all_users" | "team" | "user";

const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  all_coaches: "All coaches",
  all_users: "All users",
  team: "One team",
  user: "One person",
};

export function SendNotificationPanel() {
  const qc = useQueryClient();
  const contextFn = useServerFn(getBroadcastContext);
  const kpiFn = useServerFn(getNotificationKpis);
  const send = useServerFn(sendBroadcast);

  const ctx = useQuery({ queryKey: ["broadcast-context"], queryFn: () => contextFn({}) });
  const kpis = useQuery({ queryKey: ["notification-kpis"], queryFn: () => kpiFn({}) });

  const [audienceKind, setAudienceKind] = useState<AudienceKind>("all_coaches");
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [channels, setChannels] = useState<string[]>(["inapp", "push"]);
  const [confirming, setConfirming] = useState(false);

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const broadcast = useMutation({
    mutationFn: () =>
      send({
        data: {
          audienceKind,
          teamId: teamId || undefined,
          email: email || undefined,
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || undefined,
          channels,
        },
      }),
    onSuccess: (r) => {
      setConfirming(false);
      setTitle("");
      setBody("");
      setLink("");
      void qc.invalidateQueries({ queryKey: ["broadcast-context"] });
      void qc.invalidateQueries({ queryKey: ["notification-kpis"] });
      toast.success(
        `Sent to ${r.recipients} people — ${r.pushSent} device alerts, ${r.emailQueued} emails queued`,
      );
    },
    onError: (e: Error) => {
      setConfirming(false);
      toast.error(e.message);
    },
  });

  const ready = title.trim().length > 1 && body.trim().length > 1 && channels.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-3">
        <div className="text-center">
          <Heading tone="grape">Send Notification</Heading>
        </div>
        <Note>
          Owner-only engagement messages. Everything sent here is logged with the audience, channels
          and counts.
        </Note>

        <Field label="Who gets it">
          <SelectInput value={audienceKind} onChange={(e) => setAudienceKind(e.target.value as AudienceKind)}>
            {(Object.keys(AUDIENCE_LABEL) as AudienceKind[]).map((k) => (
              <option key={k} value={k}>
                {AUDIENCE_LABEL[k]}
              </option>
            ))}
          </SelectInput>
        </Field>

        {audienceKind === "team" ? (
          <Field label="Team">
            <SelectInput value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Pick a team…</option>
              {(ctx.data?.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.season}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}

        {audienceKind === "user" ? (
          <Field label="Their email">
            <TextInput
              placeholder="coach@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Title">
          <TextInput
            placeholder="Try today's Play of the Day"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Message">
          <TextInput
            placeholder="Open CoachSide and add it to your Playbook before practice."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <Field label="Link (optional)">
          <TextInput placeholder="/library" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Channels</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "inapp", label: "In-app" },
              { id: "push", label: "Push" },
              { id: "email", label: "Email" },
            ].map((c) => (
              <BubbleButton
                key={c.id}
                size="sm"
                tone={channels.includes(c.id) ? "grape" : "neutral"}
                onClick={() => toggleChannel(c.id)}
              >
                {c.label}
              </BubbleButton>
            ))}
          </div>
          {!ctx.data?.emailConfigured && channels.includes("email") ? (
            <Note>
              Email delivery is not configured yet — email messages are stored in the queue and will
              go out once a provider is connected.
            </Note>
          ) : null}
          {!ctx.data?.pushConfigured ? <Note>Push keys are not configured on this server.</Note> : null}
        </div>

        {confirming ? (
          <InfoPanel tone="grape">
            <div className="flex flex-col gap-1">
              <span className="font-black">{title || "Untitled"}</span>
              <span>{body}</span>
              <span className="text-xs text-muted-foreground">
                {AUDIENCE_LABEL[audienceKind]} · {channels.join(", ")}
                {link ? ` · ${link}` : ""}
              </span>
            </div>
          </InfoPanel>
        ) : null}

        <PrimaryCTA>
          {confirming ? (
            <>
              <BubbleButton tone="flame" disabled={broadcast.isPending} onClick={() => broadcast.mutate()}>
                {broadcast.isPending ? "Sending…" : "Confirm and send"}
              </BubbleButton>
              <BubbleButton tone="neutral" onClick={() => setConfirming(false)}>
                Back
              </BubbleButton>
            </>
          ) : (
            <BubbleButton tone="grape" size="lg" disabled={!ready} onClick={() => setConfirming(true)}>
              Preview message
            </BubbleButton>
          )}
        </PrimaryCTA>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div className="text-center">
          <Heading tone="flame">Notification health</Heading>
        </div>
        {!kpis.data ? (
          <EmptyState>Loading notification numbers…</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="People with push" value={String(kpis.data.pushEnabledUsers)} />
            <StatTile label="Active devices" value={String(kpis.data.activeDevices)} />
            <StatTile label="Pushes sent" value={String(kpis.data.pushSent)} />
            <StatTile label="Push failures" value={String(kpis.data.pushFailed)} />
            <StatTile label="Alerts created" value={String(kpis.data.notificationsCreated)} />
            <StatTile label="Alerts opened" value={String(kpis.data.notificationsOpened)} />
            <StatTile label="Emails queued" value={String(kpis.data.emailQueued)} />
            <StatTile
              label="Emails sent"
              value={kpis.data.emailConfigured ? String(kpis.data.emailSent) : "Not set up"}
            />
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-2">
        <div className="text-center">
          <Heading tone="grape">Recent sends</Heading>
        </div>
        {!(ctx.data?.recent ?? []).length ? (
          <EmptyState>Nothing has been sent yet</EmptyState>
        ) : (
          (ctx.data?.recent ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-3 py-2">
              <span className="text-sm font-black text-foreground">{r.title}</span>
              <Pill tone="muted">{AUDIENCE_LABEL[r.audience_kind as AudienceKind] ?? r.audience_kind}</Pill>
              <Pill tone="neutral">{r.recipient_count} people</Pill>
              <Pill tone="grape">{r.push_sent} pushes</Pill>
              {r.push_failed ? <Pill tone="flame">{r.push_failed} failed</Pill> : null}
              <span className="ml-auto text-xs font-semibold text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
