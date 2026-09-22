/**
 * "Enable CoachSide Notifications".
 *
 * The browser permission prompt only ever opens from the button below. On
 * iPhone/iPad the card explains the Home Screen step instead of showing a
 * button that the browser would refuse.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BubbleButton, Heading, InfoList, Note, Panel, Pill, PrimaryCTA } from "@/components/Bubbles";
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
  const [state, setState] = useState<PushState | null>(null);

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

  return (
    <Panel className="flex flex-col gap-3">
      <div className="text-center">
        <Heading tone="grape">Enable CoachSide Notifications</Heading>
      </div>
      <Note>
        Get told the moment your coach posts an announcement, a new play or an assignment — plus the
        daily featured play from the CoachSide Library.
      </Note>

      {state === "needs_install" ? (
        <>
          <InfoList
            items={[
              "Tap the Share button in Safari",
              "Choose Add to Home Screen",
              "Open CoachSide from your Home Screen, then come back here",
            ]}
          />
          <Note>iPhone and iPad can only send notifications once CoachSide is on your Home Screen.</Note>
        </>
      ) : null}

      {state === "unsupported" ? (
        <Note>This browser can't show notifications. Try Chrome on Android, or install CoachSide.</Note>
      ) : null}

      {state === "blocked" ? (
        <Note>
          Notifications are blocked for CoachSide in this browser's settings. Allow them there, then
          come back and turn them on.
        </Note>
      ) : null}

      {state === "off" ? (
        <PrimaryCTA>
          <BubbleButton
            tone="grape"
            size="lg"
            disabled={enable.isPending || !cfg.data?.publicKey}
            onClick={() => enable.mutate()}
          >
            {enable.isPending ? "Turning on…" : "Turn on notifications"}
          </BubbleButton>
        </PrimaryCTA>
      ) : null}

      {state === "on" ? (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            <Pill tone="grape">Notifications on for this device</Pill>
            {activeDevices.length > 1 ? (
              <Pill tone="neutral">{activeDevices.length} devices</Pill>
            ) : null}
          </div>
          <PrimaryCTA>
            <BubbleButton tone="flame" disabled={testPush.isPending} onClick={() => testPush.mutate()}>
              {testPush.isPending ? "Sending…" : "Send test notification"}
            </BubbleButton>
            <BubbleButton tone="neutral" disabled={disable.isPending} onClick={() => disable.mutate()}>
              {disable.isPending ? "Turning off…" : "Turn off on this device"}
            </BubbleButton>
          </PrimaryCTA>
        </>
      ) : null}

      {cfg.data && !cfg.data.emailConfigured ? (
        <Note>Email delivery is not configured yet, so alerts arrive in the app and on your devices.</Note>
      ) : null}
    </Panel>
  );
}
