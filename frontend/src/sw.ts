/// <reference lib="webworker" />
/**
 * Service worker (PLAN §5.1): precache the app shell and fall back to index.html for navigations
 * so the app opens offline. It deliberately has NO route for /api or /photos: API responses and
 * the household's photos are never cached here, because cookie-gated data must not outlive
 * signing out. Updates wait: phones tap Refresh, and the wall screen reloads itself at night.
 *
 * The cached index.html keeps the CSP header it was fetched with, whose style nonce matches its
 * own <meta name="csp-nonce"> (ADR 0007), so the offline copy stays consistent.
 */
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// The first install takes charge of the open page at once; later versions wait (SKIP_WAITING).
clientsClaim();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/photos\//],
  }),
);

self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "SKIP_WAITING"
  ) {
    void self.skipWaiting();
  }
});
