import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import {
  isSitemapRouteIncluded,
  sitemapPathForLocation,
  sitemapStaticPaths,
  sitemapXML,
  type SitemapEntry,
} from "@/lib/sitemap";
import { publicLibraryClient } from "@/lib/publicPlay.functions";

const BASE_URL = "https://coachside.live";
const PLAY_ROUTE_ID = "/library/$playId";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));

        // Every published Library play, from the same anon-readable feed the page uses.
        if (isSitemapRouteIncluded(router.routesById[PLAY_ROUTE_ID])) {
          const sb = publicLibraryClient();
          const pageSize = 1000;
          for (let offset = 0; ; ) {
            const { data, error } = await sb
              .rpc("library_feed" as never, { _creator: null } as never)
              .select("id, published_at")
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) {
              console.error("sitemap library_feed", error.message);
              return new Response("Sitemap temporarily unavailable", {
                status: 503,
                headers: { "Cache-Control": "no-store" },
              });
            }
            const rows = (data ?? []) as { id: string; published_at: string | null }[];
            if (rows.length === 0) break;
            for (const row of rows) {
              const location = router.buildLocation({
                to: "/library/$playId",
                params: { playId: row.id },
                search: () => ({}),
                hash: "",
              });
              const path = sitemapPathForLocation(router, location, PLAY_ROUTE_ID);
              if (path) {
                entries.push({
                  path,
                  ...(row.published_at ? { lastmod: row.published_at.slice(0, 10) } : {}),
                });
              }
            }
            offset += rows.length;
          }
        }

        if (entries.length === 0) {
          return new Response("No pages are included in this sitemap.", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
        }
        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
