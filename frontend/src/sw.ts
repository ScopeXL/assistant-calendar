/// <reference lib="webworker" />
/**
 * Service worker (PLAN §5.1, ADR 0034). The page itself comes from the server whenever it answers
 * (within 3 s), so a refresh after an update shows the new version at once; the copy precached at
 * install answers only when the server can't be reached, so the app still opens offline. The
 * build's hashed files are precached. No route for /api or /photos: cookie-gated data is never
 * cached here. Updates wait (registerType "prompt"): phones tap Refresh and the wall reloads at
 * night, so an open page built from the old version keeps its lazy chunks until then. The cached
 * index.html keeps the CSP header it was fetched with, whose nonce matches its own meta (ADR 0007).
 */
import { clientsClaim } from "workbox-core";
import type { WorkboxPlugin } from "workbox-core/types";
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] };

/** How long a navigation waits for the server before the cached page answers instead. */
const SERVER_WAIT_S = 3;

/**
 * A proxy's 502 while the container restarts is the server not answering too: the cached page
 * opens instead of the proxy's error page, so the wall never lands on a dead end.
 */
const serverErrorIsUnreachable: WorkboxPlugin = {
  fetchDidSucceed: ({ response }) =>
    response.status >= 500
      ? Promise.reject(new Error(`The server answered ${String(response.status)}.`))
      : Promise.resolve(response),
};

/** The server didn't answer: the page saved at install (as Workbox's PrecacheFallbackPlugin). */
const savedPage: WorkboxPlugin = {
  handlerDidError: () => matchPrecache("/index.html"),
};

// Registered first: routes match in order, and the precache route would otherwise answer "/" from
// the cache. No runtime cache for pages: a newer index.html cached offline would name files the
// precache doesn't have.
registerRoute(
  new NavigationRoute(
    new NetworkOnly({
      networkTimeoutSeconds: SERVER_WAIT_S,
      plugins: [serverErrorIsUnreachable, savedPage],
    }),
    { denylist: [/^\/api\//, /^\/photos\//] },
  ),
);
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// The first install takes charge of the open page at once; later versions wait (SKIP_WAITING).
clientsClaim();

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
