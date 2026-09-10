/**
 * Guarded service-worker registration.
 *
 * The app shell is cached only in the real published app. Lovable previews,
 * iframes and dev never register a worker, and any stale worker found in
 * those contexts is removed so nobody gets trapped on an old build.
 * Live-game events keep using the existing IndexedDB queue — the worker does
 * not cache API or database responses.
 */
const SW_URL = "/sw.js";

function blockedHost(hostname: string) {
  const blocked = [
    "lovableproject.com",
    "lovableproject-dev.com",
    "beta.lovable.dev",
  ];
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  return blocked.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const refuse =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    blockedHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("sw") ;

  if (refuse) {
    void unregisterAppWorker();
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => undefined);
  });

  // A new app-shell version takes over as soon as it activates.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/** True when the app is running from the home screen / app launcher. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
