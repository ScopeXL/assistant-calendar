/**
 * Synced calendars end to end (PLAN §15 M2), against the test server's scripted calendar
 * server: an account's calendar mapped to a person shows on the wall in that person's color; a
 * change made on the wall goes out to the server; a refused password shows the quiet pill and
 * the events stay. Adding an account from any device (ADR 0028): a computer gets the steps in a
 * sheet, and Google's way back opens a new account's calendars; the wall types a password on
 * its own keyboard and hands Google's file and page to a phone. The server's clock reads
 * Wednesday, October 7, 2026, 10:00 AM in New York. Synthetic data only.
 */
import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, pairWall, PASSWORD, scriptedAccount, seed, signInPhone, test } from "./fixtures";

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

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

async function board(page: Page) {
  await pairWall(page);
  await page.goto("/display");
  const week = page.getByRole("region", { name: "This Week" });
  await expect(week).toBeVisible();
  return week;
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(
    testInfo.project.name !== "display-1080p" && testInfo.project.name !== "desktop",
    "the wall screen at 1080p, and a computer",
  );
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
}, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen");
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

test("a refused password shows a quiet pill, and the events stay", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen");
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

test("a computer adds an account in a sheet, and Google's way back opens its calendars", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "a computer");
  await signInPhone(page);
  await page.goto("/settings/calendars");
  await page.getByRole("button", { name: "Add an account" }).click();
  const sheet = page.getByRole("dialog", { name: "Add an Account" });
  await expect(sheet.getByRole("button", { name: /^iCloud/ })).toBeVisible();
  await expect(sheet.getByText("Or add it from a phone")).toHaveCount(0);
  await sheet.getByRole("button", { name: /^Google/ }).click();
  const google = page.getByRole("dialog", { name: "Google" });
  await expect(google.getByText("From a phone")).toHaveCount(0);
  await google.getByRole("button", { name: /^Share with a Sunroom helper/ }).click();
  const helper = page.getByRole("dialog", { name: "Google: Share with a Helper" });
  await expect(helper.getByLabel("Upload the key file")).toBeVisible();
  await helper.getByRole("button", { name: "Close" }).click();
  await expect(helper).toBeHidden();

  // Google's sign-in sends the browser back with a new account: here, the scripted one.
  const account = await scriptedAccount(request, { mapped: false });
  await page.goto(`/settings/calendars?google=connected&account=${account}`);
  const pick = page.getByRole("dialog", { name: "Pick Calendars" });
  await expect(pick).toBeVisible();
  await expect(toast(page, "Connected Google")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/calendars$/);
  await pick
    .getByRole("group", { name: "Whose is School" })
    .getByRole("button", { name: "Mia" })
    .click();
  await pick.getByRole("button", { name: "Done" }).click();
  await expect(toast(page, "Connected Test server · 1 calendar")).toBeVisible();
  await expect(pick).toBeHidden();
  await expect(
    page.getByRole("group", { name: "Whose is School" }).getByRole("button", { name: "Mia" }),
  ).toHaveAttribute("aria-pressed", "true");

  // A sign-in that didn't finish says so, in the app's words, and the address comes clean.
  await page.goto("/settings/calendars?google=denied");
  await expect(toast(page, "Google didn't finish signing in. Try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/calendars$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the wall adds an account itself, and hands Google's file and page to a phone", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen");
  await pairWall(page);
  await page.goto("/settings/calendars");
  const add = page.getByRole("button", { name: "Add an account" });
  await add.click();
  const sheet = page.getByRole("dialog", { name: "Add an Account" });
  await expect(sheet.getByText("Or add it from a phone")).toBeVisible();
  await expect(
    sheet.getByRole("img", { name: "A code that opens Add an Account on a phone" }),
  ).toBeVisible();

  // iCloud: the password is a masked field, typed on the screen's own keyboard.
  await sheet.getByRole("button", { name: /^iCloud/ }).click();
  const icloud = page.getByRole("dialog", { name: "iCloud" });
  await expect(icloud.getByRole("link")).toHaveCount(0);
  const password = icloud.getByLabel("App-specific password");
  await expect(password).toHaveAttribute("type", "password");
  await password.click();
  const keyboard = page.getByRole("group", { name: "On-screen keyboard" });
  for (const key of ["a", "b", "c"]) {
    await keyboard.getByRole("button", { name: key, exact: true }).click();
  }
  await expect(password).toHaveValue("abc");
  const keys = await keyboard.boundingBox();
  const field = await password.boundingBox();
  expect(keys && field && field.y + field.height <= keys.y).toBe(true);
  await keyboard.getByRole("button", { name: "Done" }).click();
  await icloud.getByRole("button", { name: "Close" }).click();
  await expect(icloud).toBeHidden();

  // Google: the secret address runs here; the helper's key file and Google's page need a phone.
  await add.click();
  await sheet.getByRole("button", { name: /^Google/ }).click();
  const google = page.getByRole("dialog", { name: "Google" });
  await expect(google.getByRole("button", { name: /^Paste the secret address/ })).not.toContainText(
    "From a phone",
  );
  await expect(google.getByRole("button", { name: /^Share with a Sunroom helper/ })).toContainText(
    "From a phone",
  );
  await expect(google.getByRole("button", { name: /^Sign in with Google/ })).toContainText(
    "From a phone",
  );
  await google.getByRole("button", { name: /^Sign in with Google/ }).click();
  const signIn = page.getByRole("dialog", { name: "Sign in with Google" });
  await expect(signIn).toContainText("Do this from a phone");
  await expect(
    signIn.getByRole("img", { name: "A code that opens Add an Account on a phone" }),
  ).toBeVisible();
  await expect(signIn.getByRole("button", { name: "Sign in with Google" })).toHaveCount(0);
  // A tap on the backdrop still closes it (a press that started there).
  await page.mouse.click(40, 540);
  await expect(signIn).toBeHidden();
});
