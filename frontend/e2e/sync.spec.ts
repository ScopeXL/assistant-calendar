/**
 * Synced calendars end to end (PLAN §15 M2), against the test server's scripted calendar
 * server: an account's calendar mapped to a person shows on the wall in that person's color; a
 * change made on the wall goes out to the server; a refused password shows the quiet pill and
 * the events stay. The server's clock reads Wednesday, October 7, 2026, 10:00 AM in New York.
 * Synthetic data only.
 */
import type { APIRequestContext, Page } from "@playwright/test";

import { expect, pairWall, PASSWORD, seed, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

/** A scripted account with a School calendar holding Thursday's field trip, not mapped yet. */
async function accountWithFieldTrip(request: APIRequestContext): Promise<string> {
  const created = await request.post("/api/calendar-sync/_test/fake", { headers: CSRF });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const scripted = await request.put(`/api/calendar-sync/_test/fake/${id}`, {
    headers: CSRF,
    data: {
      calendars: [["school", "School", false]],
      events: [
        {
          calendar: "school",
          uid: "field-trip@test",
          title: "Field trip",
          start: "2026-10-08T13:00:00Z",
          end: "2026-10-08T17:00:00Z",
        },
      ],
    },
  });
  expect(scripted.status()).toBe(200);
  return id;
}

async function syncNow(request: APIRequestContext, account: string): Promise<void> {
  const synced = await request.post(`/api/calendar-sync/accounts/${account}/sync`, {
    headers: CSRF,
  });
  expect([200, 409, 429]).toContain(synced.status());
}

async function mapToMia(request: APIRequestContext, account: string): Promise<void> {
  const members = (await (await request.get("/api/members")).json()) as {
    id: string;
    name: string;
  }[];
  const mia = members.find((m) => m.name === "Mia");
  let calendars: { id: string }[] = [];
  await expect(async () => {
    const accounts = (await (await request.get("/api/calendar-sync/accounts")).json()) as {
      id: string;
      calendars: { id: string }[];
    }[];
    calendars = accounts.find((a) => a.id === account)?.calendars ?? [];
    expect(calendars.length).toBe(1);
  }).toPass({ timeout: 10_000 });
  const mapped = await request.put(
    `/api/calendar-sync/accounts/${account}/calendars/${calendars[0]?.id ?? ""}`,
    { headers: CSRF, data: { mapped: true, owner_member_id: mia?.id } },
  );
  expect(mapped.status()).toBe(200);
}

async function board(page: Page) {
  await pairWall(page);
  await page.goto("/display");
  const week = page.getByRole("region", { name: "This week" });
  await expect(week).toBeVisible();
  return week;
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  const moved = await request.post("/api/_test/clock", {
    headers: CSRF,
    data: { set: WEDNESDAY_10AM },
  });
  expect(moved.status()).toBe(204);
  await seed(request);
  // A parent's phone, signed in with the household password (its cookie stays on `request`).
  const signedIn = await request.post("/api/auth/login", {
    headers: CSRF,
    data: { password: PASSWORD },
  });
  expect(signedIn.ok()).toBe(true);
});

test("an account's calendar shows on the wall in its person's color, and changes go back", async ({
  page,
  request,
}) => {
  const account = await accountWithFieldTrip(request);
  await syncNow(request, account);
  await mapToMia(request, account);
  const week = await board(page);
  const trip = week.getByRole("button", { name: /^Field trip, 9:00 AM to 1:00 PM, Mia, Thursday/ });
  await expect(trip).toBeVisible({ timeout: 15_000 });
  await expect(trip).toHaveAttribute("data-person", "rose");

  // Its sheet says where it comes from.
  await trip.click();
  const sheet = page.getByRole("dialog", { name: "Field trip" });
  await expect(sheet).toContainText("School");
  await sheet.getByRole("button", { name: "Change" }).click();
  const editor = page.getByRole("dialog", { name: "Change" });
  await editor.getByLabel("Title").fill("Field trip to the farm");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(week.getByRole("button", { name: /^Field trip to the farm, / })).toBeVisible();

  // The server gets it within the next push (every minute, or a few seconds after an edit).
  await expect(async () => {
    const accounts = (await (await request.get("/api/calendar-sync/accounts")).json()) as {
      id: string;
      last_error: string | null;
    }[];
    expect(accounts.find((a) => a.id === account)?.last_error).toBeNull();
    const event = (await (
      await request.get("/api/calendar/occurrences", {
        params: { from: "2026-10-04", to: "2026-10-11" },
      })
    ).json()) as { occurrences: { title: string; pending: boolean }[] };
    expect(event.occurrences.find((o) => o.title === "Field trip to the farm")?.pending).toBe(
      false,
    );
  }).toPass({ timeout: 20_000 });
});

test("a refused password shows a quiet pill, and the events stay", async ({ page, request }) => {
  const account = await accountWithFieldTrip(request);
  await syncNow(request, account);
  await mapToMia(request, account);
  const week = await board(page);
  await expect(week.getByRole("button", { name: /^Field trip, / })).toBeVisible({
    timeout: 15_000,
  });
  const failing = await request.put(`/api/calendar-sync/_test/fake/${account}`, {
    headers: CSRF,
    data: { fail_next: ["auth"] },
  });
  expect(failing.status()).toBe(200);
  await request.post("/api/_test/clock", { headers: CSRF, data: { advance_minutes: 2 } });
  await syncNow(request, account);
  await expect(page.getByRole("button", { name: /needs its password again/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(week.getByRole("button", { name: /^Field trip, / })).toBeVisible();
});
