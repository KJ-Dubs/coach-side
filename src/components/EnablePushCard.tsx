/**
 * "Enable CoachSide Notifications".
 *
 * The browser permission prompt only ever opens from the button below. On
 * iPhone/iPad the card explains the Home Screen step instead of showing a
 * button that the browser would refuse.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { BubbleButton, Panel, PrimaryCTA } from "@/components/Bubbles";
import { useInstallApp } from "@/components/InstallApp";
import {
  getPushConfig,
  listMyDevices,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/notifications.functions";
import { currentPushState, subscribeThisDevice, unsubscribeThisDevice, type PushState } from "@/lib/push";

export function EnablePushCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [state, setState] = useState<PushState | null>(null);
  const installApp = useInstallApp();

  const config = useServerFn(getPushConfig);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const test = useServerFn(sendTestPush);
  const devicesFn = useServerFn(listMyDevices);

  const cfg = useQuery({ queryKey: ["push-config"], queryFn: () => config({}) });
  const devices = useQuery({ queryKey: ["push-devices"], queryFn: () => devicesFn({}) });

  useEffect(() => {
    void currentPushState().then(setState);
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const key = cfg.data?.publicKey;
      if (!key) throw new Error("Notifications aren't switched on for CoachSide yet.");
      const payload = await subscribeThisDevice(key);
      await save({ data: payload });
    },
    onSuccess: async () => {
      setState(await currentPushState());
      void qc.invalidateQueries({ queryKey: ["push-devices"] });
      toast.success("Notifications are on for this device");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeThisDevice();
      if (endpoint) await remove({ data: { endpoint } });
    },
    onSuccess: async () => {
      setState(await currentPushState());
      void qc.invalidateQueries({ queryKey: ["push-devices"] });
      toast.success("Notifications are off for this device");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testPush = useMutation({
    mutationFn: () => test({}),
    onSuccess: (r) => {
      if (r.sent > 0) toast.success("Test notification sent to your devices");
      else toast.error("No device received it — try turning notifications on again.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeDevices = (devices.data ?? []).filter((d) => d.active);
  const shouldInstall = state === "needs_install" || (!installApp.installed && installApp.hasPrompt);

  const install = async () => {
    if (installApp.hasPrompt) {
      await installApp.install();
      setState(await currentPushState());
      return;
    }
    await navigate({ to: "/help", hash: "notifications" });
  };

  return (
    <Panel className="flex flex-col items-center gap-2.5 px-4 py-4 text-center">
      <h2 className="text-xl font-black leading-tight text-foreground sm:text-2xl">
        Stay Updated with CoachSide
      </h2>
      <p className="max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground">
        Get alerts for team announcements, new plays, assignments, schedule changes, and the daily Play of the Day.
      </p>

      {state === "needs_install" ? (
        <p className="max-w-xl text-sm leading-relaxed text-foreground">
          On iPhone or iPad, open CoachSide in Safari, tap Share, then Add to Home Screen. Open the installed app to enable notifications.
        </p>
      ) : null}

      {installApp.hasPrompt && state !== "on" ? (
        <p className="max-w-xl text-sm leading-relaxed text-foreground">
          On Android or Chrome, choose Install App or Add to Home Screen, then open CoachSide from your home screen.
        </p>
      ) : null}

      {state === "unsupported" && !shouldInstall ? (
        <p className="text-sm text-foreground">Push notifications aren't available in this browser.</p>
      ) : null}

      {state === "blocked" ? (
        <p className="max-w-xl text-sm leading-relaxed text-foreground">
          Allow CoachSide notifications in your browser settings, then return here.
        </p>
      ) : null}

      {shouldInstall ? (
        <PrimaryCTA>
          <BubbleButton tone="flame" size="lg" onClick={() => void install()}>
            <Download className="h-5 w-5" aria-hidden />
            Install CoachSide
          </BubbleButton>
        </PrimaryCTA>
      ) : state === "off" ? (
        <PrimaryCTA>
          <BubbleButton tone="grape" size="lg" disabled={enable.isPending || !cfg.data?.publicKey} onClick={() => enable.mutate()}>
            <Bell className="h-5 w-5" aria-hidden />
            {enable.isPending ? "Enabling…" : "Enable Notifications"}
          </BubbleButton>
        </PrimaryCTA>
      ) : state === "blocked" ? (
        <PrimaryCTA>
          <BubbleButton tone="grape" size="lg" disabled>
            <Bell className="h-5 w-5" aria-hidden /> Enable Notifications
          </BubbleButton>
        </PrimaryCTA>
      ) : null}

      {state === "on" ? (
        <>
          <PrimaryCTA>
            <BubbleButton tone="grape" size="lg" disabled>
              <Check className="h-5 w-5" aria-hidden /> Notifications are on
            </BubbleButton>
          </PrimaryCTA>
          {activeDevices.length > 1 ? (
            <p className="text-xs font-semibold text-muted-foreground">Active on {activeDevices.length} devices</p>
          ) : null}
          <Link
            to="/profile"
            hash="notification-preferences"
            className="text-sm font-bold text-grape-bright underline decoration-grape/60 underline-offset-4 hover:text-foreground"
          >
            Manage notification preferences
          </Link>
          <div className="flex flex-wrap justify-center gap-2">
            <BubbleButton size="sm" tone="neutral" disabled={testPush.isPending} onClick={() => testPush.mutate()}>
              {testPush.isPending ? "Sending…" : "Send test notification"}
            </BubbleButton>
            <BubbleButton size="sm" tone="ghost" disabled={disable.isPending} onClick={() => disable.mutate()}>
              {disable.isPending ? "Turning off…" : "Turn off on this device"}
            </BubbleButton>
          </div>
        </>
      ) : null}

      {state !== "on" ? (
        <Link
          to="/help"
          hash="notifications"
          className="text-sm font-bold text-grape-bright underline decoration-grape/60 underline-offset-4 hover:text-foreground"
        >
          How to install CoachSide
        </Link>
      ) : null}
    </Panel>
  );
}
