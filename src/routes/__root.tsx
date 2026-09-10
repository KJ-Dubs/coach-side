import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border/70 bg-surface/80 p-5 text-center shadow-lg shadow-black/30">
        <span className="rounded-2xl border border-flame/60 bg-flame/20 px-5 py-2 text-5xl font-black text-foreground">
          404
        </span>
        <h1 className="rounded-2xl border border-border bg-surface-2/80 px-4 py-2 text-lg font-black text-foreground">
          Page not found
        </h1>
        <p className="rounded-2xl border border-border/60 bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
          That page doesn't exist or has moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full border border-grape bg-grape px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-grape/90"
        >
          Back to CoachSide
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border/70 bg-surface/80 p-5 text-center shadow-lg shadow-black/30">
        <h1 className="rounded-2xl border border-border bg-surface-2/80 px-4 py-2 text-lg font-black text-foreground">
          This page didn't load
        </h1>
        <p className="rounded-2xl border border-border/60 bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
          Something went wrong on our end. Try again or head back home.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full border border-grape bg-grape px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-grape/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-grape/70"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "CoachSide — Basketball Live Stats & Playbook" },
      {
        name: "description",
        content:
          "Fast courtside basketball stat tracking, season stats and a visual play designer for coaches.",
      },
      { name: "author", content: "CoachSide" },
      { name: "theme-color", content: "#0f0f12" },
      { property: "og:site_name", content: "CoachSide" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CoachSide — Basketball Live Stats & Playbook" },
      {
        property: "og:description",
        content:
          "Fast courtside basketball stat tracking, season stats and a visual play designer for coaches.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Single auth listener: identity changes re-run route guards and refresh
  // cached data. Sign-out does not refetch (the cache is torn down by signOut()).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
