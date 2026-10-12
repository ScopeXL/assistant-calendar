import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { qk } from "../../api/keys";
import type { components } from "../../api/schema";
import { toasts } from "../../lib/toast";
import { SettingsMeals } from "./SettingsMeals";

type Field = components["schemas"]["FieldOut"];
type Values = Record<string, unknown>;

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
function field(key: string, label: string): Field {
  return {
    key,
    label,
    type: "multichoice",
    help: "",
    default: null,
    required: false,
    min: null,
    max: null,
    step: null,
    unit: null,
    group: "",
    choices: MEALS,
    choice_labels: ["Breakfast", "Lunch", "Dinner", "Snack"],
    max_length: null,
  };
}
const SPEC = [field("slots", "Which meals"), field("calendar_slots", "On the calendar")];

/** The page over a server that takes whatever is sent, and answers every later read with it. */
function draw(values: Values) {
  let stored = values;
  const plugins = () => [{ id: "meals", settings_spec: SPEC, settings: stored }];
  const sent: Values[] = [];
  vi.spyOn(api, "GET").mockImplementation((() =>
    Promise.resolve({ data: plugins(), response: new Response(null, { status: 200 }) })) as never);
  vi.spyOn(api, "PUT").mockImplementation(((_path: string, init: unknown) => {
    stored = (init as { body: { values: Values } }).body.values;
    sent.push(stored);
    return Promise.resolve({ data: stored, response: new Response(null, { status: 200 }) });
  }) as never);
  const client = new QueryClient();
  client.setQueryData(qk.plugins(), plugins());
  render(
    <QueryClientProvider client={client}>
      <SettingsMeals />
    </QueryClientProvider>,
  );
  return sent;
}

function switches(): [string, boolean][] {
  return screen
    .getAllByRole<HTMLInputElement>("switch")
    .map((input) => [input.labels?.[0]?.textContent ?? "", input.checked]);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toasts.set([]);
});

describe("Settings → Meals (UX §4)", () => {
  it("has a calendar switch for each meal the family plans, in the day's order", () => {
    draw({ slots: ["dinner", "breakfast"], calendar_slots: ["dinner", "snack"] });
    expect(switches()).toEqual([
      ["Show breakfast on the calendar", false],
      ["Show dinner on the calendar", true],
    ]);
    // The meals themselves are chips above; the calendar's choices aren't drawn twice.
    expect(screen.getByRole("group", { name: "Which meals" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "On the calendar" })).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull(); // the page's title already says Meals
  });

  it("saves a switch the moment it changes, keeping what else was chosen", async () => {
    const sent = draw({ slots: ["breakfast", "dinner"], calendar_slots: ["dinner", "snack"] });
    fireEvent.click(screen.getByRole("switch", { name: "Show breakfast on the calendar" }));
    await waitFor(() => {
      expect(sent).toEqual([
        { slots: ["breakfast", "dinner"], calendar_slots: ["breakfast", "dinner", "snack"] },
      ]);
    });
    await waitFor(() => {
      expect(switches()).toEqual([
        ["Show breakfast on the calendar", true],
        ["Show dinner on the calendar", true],
      ]);
    });
    fireEvent.click(screen.getByRole("switch", { name: "Show dinner on the calendar" }));
    await waitFor(() => {
      expect(sent[1]).toEqual({
        slots: ["breakfast", "dinner"],
        calendar_slots: ["breakfast", "snack"],
      });
    });
  });

  it("a meal that's planned again comes back with its switch as it was", async () => {
    const sent = draw({ slots: ["dinner"], calendar_slots: ["lunch"] });
    expect(switches()).toEqual([["Show dinner on the calendar", false]]);
    fireEvent.click(screen.getByRole("button", { name: "Lunch" }));
    await waitFor(() => {
      expect(switches()).toEqual([
        ["Show lunch on the calendar", true],
        ["Show dinner on the calendar", false],
      ]);
    });
    expect(sent).toEqual([{ slots: ["dinner", "lunch"], calendar_slots: ["lunch"] }]);
  });
});
