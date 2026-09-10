// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      // The guarded wrapper in src/lib/pwa.ts is the only registrar.
      devOptions: { enabled: false },
      filename: "sw.js",
      manifestFilename: "manifest.webmanifest",
      manifest: {
        name: "CoachSide",
        short_name: "CoachSide",
        description:
          "Basketball coaching platform: live court stats, season reports, animated plays, team Locker Room and schedule.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#0f0f12",
        background_color: "#0f0f12",
        categories: ["sports", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: null,
        // Never intercept auth, OAuth callbacks, API or token-scoped routes.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth/, /^\/locker\//, /^\/share\//, /^\/join\//],
        runtimeCaching: [
          {
            // HTML navigations: always try the network first so a new release lands.
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.mode === "navigate" &&
              url.origin === self.location.origin &&
              !/^\/(api|auth)/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "coachside-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Hashed build assets and images only — never API or Supabase data.
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              url.origin === self.location.origin &&
              ["style", "script", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "coachside-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
