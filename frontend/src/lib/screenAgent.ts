/**
 * Sunroom Screen: the agent beside a wall screen's browser (ADR 0035, docs/M7.md T3).
 *
 * Its launcher opens `/display?dimmer=…&screen=<port>`, and only that document's policy lets
 * the page reach `http://127.0.0.1:<port>` (the server widens its `connect-src`). So the port is
 * read once, when the app starts on /display, and kept in memory only: a page loaded without the
 * parameter has the plain policy, and remembering the port would only produce blocked calls.
 * Nothing calls the agent without it, so a laptop on /display never meets a local-network
 * prompt. A fresh reload (an update, the nightly one) goes back to the launcher's address
 * (`screenReloadUrl`), which brings the policy and the port back; the wall then returns to the
 * room it was in by itself (ADR 0030).
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import createClient, { type Client, type Middleware } from "openapi-fetch";
import { useEffect } from "react";

import { qk } from "../api/keys";
import type { components, paths } from "../api/screen-schema";
import { createStore } from "./store";

export type ScreenState = components["schemas"]["ScreenStateOut"];
export type ScreenCapability = components["schemas"]["ScreenCapability"];
export type ScreenWifi = components["schemas"]["ScreenWifiOut"];
export type ScreenFound = components["schemas"]["ScreenFoundOut"];
export type ScreenAbout = components["schemas"]["ScreenAboutOut"];
export type ScreenClient = Client<paths>;

const POLL_MS = 30_000;

let port: number | null = null;
let noted = false;
let client: ScreenClient | null = null;

/** Read `?screen=` once, at the app's start: a port from 1024 to 65535, on /display only. */
export function noteScreenAgent(pathname: string, search: string): number | null {
  if (noted) return port;
  noted = true;
  if (pathname !== "/display") return port;
  const asked = new URLSearchParams(search).getAll("screen");
  const value = asked.length === 1 ? asked[0] : undefined;
  if (value === undefined || !/^\d{4,5}$/.test(value)) return port;
  const number = Number(value);
  port = number >= 1024 && number <= 65535 ? number : null;
  return port;
}

export function screenAgentPort(): number | null {
  return port;
}

/** Tests only: as if the app had just started. */
export function forgetScreenAgent(): void {
  port = null;
  noted = false;
  client = null;
}

/** Every change carries `X-Sunroom-Screen: 1`, which the agent asks for (and no form can send). */
const changes: Middleware = {
  onRequest({ request }) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      request.headers.set("X-Sunroom-Screen", "1");
    }
    return request;
  },
};

/** A client for an agent at `baseUrl` ("" for the screen's own pages, which it serves). */
export function createScreenClient(baseUrl: string): ScreenClient {
  const made = createClient<paths>({ baseUrl });
  made.use(changes);
  return made;
}

/** This wall's agent, when the launcher named one. */
export function screenClient(): ScreenClient | null {
  if (port === null) return null;
  client ??= createScreenClient(`http://127.0.0.1:${String(port)}`);
  return client;
}

/** Where a fresh reload goes on a screen with an agent: the launcher's own address. */
export function screenReloadUrl(dimmer: string): string | null {
  return port === null ? null : `/display?dimmer=${dimmer}&screen=${String(port)}`;
}

/** An update's progress, from the agent's event stream (`update.progress`). */
export const screenProgress = createStore<{ percent: number; step: string } | null>(null);

/** The agent's state; throws when there is no agent here or it doesn't answer. */
export async function fetchScreenState(): Promise<ScreenState> {
  const agent = screenClient();
  if (!agent) throw new Error("No screen agent here.");
  const { data, error } = await agent.GET("/api/screen");
  if (error !== undefined) throw new Error("The screen didn't answer.");
  return data;
}

/** The agent's state, polled every 30 s (and kept current by `useScreenAgentEvents`); `null`
 * when this page has no agent or it doesn't answer. */
export function useScreenAgent(): ScreenState | null {
  const present = screenAgentPort() !== null;
  const { data, isError } = useQuery({
    queryKey: qk.screen.state(),
    queryFn: fetchScreenState,
    enabled: present,
    refetchInterval: POLL_MS,
    retry: 1,
  });
  if (!present || isError) return null;
  return data ?? null;
}

/** Follow the agent's event stream (mounted once, by the display shell). */
export function useScreenAgentEvents(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (port === null || typeof EventSource === "undefined") return;
    const source = new EventSource(`http://127.0.0.1:${String(port)}/api/screen/events`);
    const unlisten = listen(source, queryClient);
    return () => {
      unlisten();
      source.close();
    };
  }, [queryClient]);
}

/** What the stream says, into the query cache and the progress store. */
export function listen(source: EventSource, queryClient: QueryClient): () => void {
  const onState = (event: MessageEvent<string>) => {
    queryClient.setQueryData(qk.screen.state(), JSON.parse(event.data) as ScreenState);
  };
  const onProgress = (event: MessageEvent<string>) => {
    const progress = JSON.parse(event.data) as { percent: number; step: string };
    screenProgress.set(progress.percent >= 100 ? null : progress);
  };
  source.addEventListener("state", onState);
  source.addEventListener("update.progress", onProgress);
  return () => {
    source.removeEventListener("state", onState);
    source.removeEventListener("update.progress", onProgress);
  };
}
