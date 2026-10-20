import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { qk } from "../api/keys";
import { forgetScreenAgent, noteOwnScreenAgent, type ScreenState } from "../lib/screenAgent";
import { ShellContext } from "../ui/shell";
import { CantReachPage } from "./pages/CantReachPage";
import { FindPage } from "./pages/FindPage";
import { OpeningPage } from "./pages/OpeningPage";
import { needsWifi, WelcomePage } from "./pages/WelcomePage";
import { go, route } from "./route";

vi.mock("./route", async (original) => ({
  ...(await original<typeof import("./route")>()),
  openSunroom: vi.fn(),
}));
const { openSunroom } = await import("./route");

const SUNROOM = "http://192.168.1.20:8080";

function state(overrides: Partial<ScreenState> = {}): ScreenState {
  return {
    version: "0.13.0",
    platform: "pi",
    model: "Raspberry Pi 5 Model B",
    session: "wayland",
    sunroom_os: true,
    capabilities: ["restart", "shutdown", "update", "wifi", "rotate", "run_sunroom"],
    sunroom: null,
    network: { kind: "wifi", ssid: "HomeNet", ip: "192.168.1.30", strength: 82 },
    update: {
      check: "nightly",
      state: "unknown",
      installed: "0.13.0",
      latest: null,
      checked_at: null,
      message: null,
      sunroom_outdated: false,
    },
    display: { rotation: 0, brightness_method: "none" },
    open_url: null,
    ...overrides,
  };
}

const chosen = (reachable: boolean) =>
  state({
    sunroom: {
      url: SUNROOM,
      id: "00000000-0000-7000-8000-0000000000e1",
      name: "The Sample Family",
      found: "discovered",
      reachable,
    },
    open_url: `${SUNROOM}/display?dimmer=page&screen=7800`,
  });

let calls: { method: string; path: string; body: unknown }[];
let answers: Record<string, unknown>;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.getAnimations = () => [];
});

beforeEach(() => {
  calls = [];
  answers = {};
  noteOwnScreenAgent();
  window.history.replaceState(null, "", "/");
  route.set("/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      const text = request.method === "GET" ? "" : await request.text();
      calls.push({
        method: request.method,
        path,
        body: text ? (JSON.parse(text) as unknown) : null,
      });
      const body = answers[`${request.method} ${path}`] ?? { ok: true };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  forgetScreenAgent();
  vi.unstubAllGlobals();
  vi.mocked(openSunroom).mockClear();
});

function draw(page: ReactNode, cache: (client: QueryClient) => void = () => undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  cache(client);
  render(
    <QueryClientProvider client={client}>
      <ShellContext.Provider value="display">{page}</ShellContext.Provider>
    </QueryClientProvider>,
  );
}

describe("the screen's own pages (ADR 0035)", () => {
  it("joins Wi-Fi first only on Sunroom OS with no network at all", () => {
    expect(
      needsWifi(state({ network: { kind: "none", ssid: null, ip: null, strength: null } })),
    ).toBe(true);
    expect(needsWifi(state())).toBe(false);
    expect(
      needsWifi(
        state({
          sunroom_os: false,
          network: { kind: "none", ssid: null, ip: null, strength: null },
        }),
      ),
    ).toBe(false);
  });

  it("welcomes a fresh screen, and Start goes on to finding its Sunroom", () => {
    draw(<WelcomePage state={state()} />);
    expect(screen.getByRole("heading", { name: "Sunroom", level: 1 })).toBeTruthy();
    expect(screen.getByText("Let’s get this screen set up.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(route.get()).toBe("/find");
    expect(window.location.pathname).toBe("/find");
  });

  it("lists what it found, a new Sunroom by name and an older one by version", async () => {
    answers["GET /api/screen/sunrooms"] = {
      scanning: false,
      found: [
        {
          url: SUNROOM,
          id: "00000000-0000-7000-8000-0000000000e1",
          name: "The Sample Family",
          version: "0.13.0",
          setup_complete: true,
          older: false,
        },
        {
          url: "http://192.168.1.21:8080",
          id: null,
          name: null,
          version: "0.11.0",
          setup_complete: true,
          older: true,
        },
      ],
    };
    answers["POST /api/screen/sunrooms/scan"] = answers["GET /api/screen/sunrooms"];
    draw(<FindPage state={state()} />);
    const network = screen.getByRole("region", { name: "On Your Network" });
    expect(await within(network).findByText("The Sample Family’s Sunroom")).toBeTruthy();
    expect(within(network).getByText(`${SUNROOM} · version 0.13.0`)).toBeTruthy();
    expect(within(network).getByText("A Sunroom")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Run It on This Screen" })).toBeTruthy();
    const [first] = within(network).getAllByRole("button", { name: "Use This Sunroom" });
    if (!first) throw new Error("nothing to use");
    fireEvent.click(first);
    await waitFor(() => {
      expect(route.get()).toBe("/opening");
    });
    expect(calls.find((call) => call.method === "PUT")).toEqual({
      method: "PUT",
      path: "/api/screen/sunroom",
      body: { url: SUNROOM, found: "discovered" },
    });
  });

  it("checks a typed address and says plainly what it found", async () => {
    answers["GET /api/screen/sunrooms"] = { scanning: false, found: [] };
    answers["POST /api/screen/sunroom/check"] = {
      ok: false,
      sunroom: null,
      message: "That address isn't a Sunroom. Check it and try again.",
    };
    draw(<FindPage state={state({ capabilities: ["restart"] })} />);
    expect(screen.queryByRole("region", { name: "Run It on This Screen" })).toBeNull();
    const elsewhere = screen.getByRole("region", { name: "Somewhere Else" });
    const field = within(elsewhere).getByLabelText("Type the address you were given.");
    expect((field as HTMLInputElement).value).toBe("https://");
    fireEvent.change(field, { target: { value: "https://calendar.example.com" } });
    fireEvent.click(within(elsewhere).getByRole("button", { name: "Check Address" }));
    expect(
      await within(elsewhere).findByText("That address isn't a Sunroom. Check it and try again."),
    ).toBeTruthy();
    expect(calls.find((call) => call.path === "/api/screen/sunroom/check")?.body).toEqual({
      url: "https://calendar.example.com",
    });
  });

  it("opens the Sunroom the moment it answers", () => {
    draw(<OpeningPage state={chosen(true)} />);
    expect(
      screen.getByRole("heading", { name: "Opening The Sample Family’s Sunroom…" }),
    ).toBeTruthy();
    expect(openSunroom).toHaveBeenCalledWith(`${SUNROOM}/display?dimmer=page&screen=7800`);
  });

  it("gives up opening after two minutes, for Can't Reach", () => {
    vi.useFakeTimers();
    try {
      draw(<OpeningPage state={chosen(false)} />);
      expect(openSunroom).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(119_000);
      });
      expect(route.get()).toBe("/");
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(route.get()).toBe("/cant-reach");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Can't Reach tries again on a tap, and goes back by itself when it answers", async () => {
    answers["POST /api/screen/sunroom/check"] = {
      ok: false,
      sunroom: null,
      message: "Can't reach that address from here.",
    };
    draw(<CantReachPage state={chosen(false)} />, (client) => {
      client.setQueryData(qk.screen.state(), chosen(false));
    });
    expect(
      screen.getByRole("heading", { name: "Can’t Reach The Sample Family’s Sunroom" }),
    ).toBeTruthy();
    for (const name of ["Try Again", "Wi-Fi", "Change Address", "Restart"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByText("Can't reach that address from here.")).toBeTruthy();
    expect(openSunroom).not.toHaveBeenCalled();
    cleanup();
    draw(<CantReachPage state={chosen(true)} />);
    expect(openSunroom).toHaveBeenCalledWith(`${SUNROOM}/display?dimmer=page&screen=7800`);
  });

  it("goes between its pages with the browser's history", () => {
    go("/find");
    go("/settings");
    expect(route.get()).toBe("/settings");
    go("/opening", true);
    expect(window.location.pathname).toBe("/opening");
  });
});
