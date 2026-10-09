import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { qk } from "../api/keys";
import { formatTime, householdZone, setDatePreferences } from "./dates";
import { useDatePreferences, type HouseholdSettings } from "./household";
import { useMinute } from "./time";

// 14:00 UTC: 10:00 AM in New York, 4:00 AM in Honolulu.
const MOMENT = new Date(Date.UTC(2026, 9, 7, 14, 0));

/** Only the two settings the hook reads. */
function settings(timezone: string, timeFormat: "12h" | "24h"): HouseholdSettings {
  return { timezone, time_format: timeFormat } as HouseholdSettings;
}

/** The shell's part: it reads the settings. */
function Shell() {
  useDatePreferences();
  return null;
}

/** A clock elsewhere on the screen: it reads only the minute, never the settings. */
function Clock() {
  useMinute();
  return <p>{formatTime(MOMENT)}</p>;
}

function renderWith(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <Shell />
      <Clock />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  setDatePreferences({ timezone: "UTC", timeFormat: "12h" });
});

describe("the household's zone and clock reach the screen (useDatePreferences)", () => {
  it("formats in the household's zone, and redraws at once when Settings change", async () => {
    const client = new QueryClient();
    client.setQueryData(qk.settings(), settings("America/New_York", "12h"));
    renderWith(client);
    expect(householdZone()).toBe("America/New_York");
    expect(screen.getByText("10:00 AM")).toBeTruthy();
    act(() => {
      client.setQueryData(qk.settings(), settings("America/New_York", "24h"));
    });
    expect(await screen.findByText("10:00")).toBeTruthy();
    act(() => {
      client.setQueryData(qk.settings(), settings("Pacific/Honolulu", "12h"));
    });
    expect(await screen.findByText("4:00 AM")).toBeTruthy();
  });

  it("fetches everything again when the zone changes, not when it first arrives", async () => {
    const client = new QueryClient();
    const refetch = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    client.setQueryData(qk.settings(), settings("America/New_York", "12h"));
    renderWith(client);
    act(() => {
      client.setQueryData(qk.settings(), settings("America/New_York", "24h"));
    });
    expect(await screen.findByText("10:00")).toBeTruthy();
    expect(refetch).not.toHaveBeenCalled();
    act(() => {
      client.setQueryData(qk.settings(), settings("Pacific/Honolulu", "24h"));
    });
    await waitFor(() => {
      expect(refetch).toHaveBeenCalledOnce();
    });
  });
});
