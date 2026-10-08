/**
 * Captures the key screens for review (`just screenshots`, UX §10): the wall screen at 1920×1080
 * and 1080×1920 (Standard and Extra large text), phones at 390×844 and a laptop at 1440×900, in
 * light and dark, at 09:40, 16:10 and 21:30 so the tint and theme stops show. Synthetic data
 * only; files go to the gitignored .screenshots/ folder and are never committed.
 */
import type { Page } from "@playwright/test";

import { expect, PASSWORD, PIN, resetServer, seed, settled, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
// The household's zone in end-to-end runs is America/New_York (UTC−4 in October).
const STOPS = [
  { name: "0940", at: "2026-10-07T13:40:00Z" },
  { name: "1610", at: "2026-10-07T20:10:00Z" },
  { name: "2130", at: "2026-10-08T01:30:00Z" },
];
const NIGHT = "2026-10-08T03:30:00Z";
const PAGES = [
  { key: "family", title: "Family" },
  { key: "features", title: "Features" },
  { key: "display", title: "Display" },
  { key: "household", title: "Household" },
  { key: "devices", title: "Phones & screens" },
  { key: "backup", title: "Backup" },
  { key: "about", title: "About" },
];

test.skip(!process.env.SCREENSHOTS, "run with `just screenshots`");
// Playwright's WebKit screenshot code injects an inline <style>, which the CSP blocks and
// reports. Every other spec keeps the guard on, so real violations are still caught.
test.use({ cspGuard: false });

async function shot(page: Page, name: string): Promise<void> {
  await settled(page);
  await page.screenshot({
    path: `../.screenshots/${test.info().project.name}/${name}.png`,
    // The default caret: "hide" injects an inline <style>, which the CSP rightly blocks.
    caret: "initial",
    animations: "disabled",
  });
}

async function moveClock(page: Page, at: string): Promise<void> {
  const response = await page.request.post("/api/_test/clock", {
    headers: CSRF,
    data: { set: at },
  });
  expect(response.status()).toBe(204);
}

async function change(page: Page, settings: Record<string, unknown>): Promise<void> {
  const response = await page.request.patch("/api/settings", { headers: CSRF, data: settings });
  expect(response.status()).toBe(200);
}

test("the wall screen", async ({ page }) => {
  test.skip(!test.info().project.name.startsWith("display"), "the wall screen");
  test.setTimeout(240_000);
  await moveClock(page, STOPS[0]?.at ?? "");
  await page.goto("/display");
  await expect(page.getByRole("heading", { name: "Set up Sunroom on your phone" })).toBeVisible();
  await shot(page, "display-setup");
  await seed(page.request);
  await page.reload();
  await expect(page.getByTestId("pair-code")).toBeVisible();
  await shot(page, "display-pair");
  await page.getByRole("button", { name: "Type the household password here instead" }).click();
  await page.getByLabel("Household password").click();
  await expect(page.getByRole("group", { name: "On-screen keyboard" })).toBeVisible();
  await shot(page, "display-keyboard");
  await page.getByLabel("Household password").fill(PASSWORD);
  await page.getByRole("button", { name: "Pair this screen" }).click();
  await expect(page.getByRole("heading", { name: "Name this screen" })).toBeVisible();
  await shot(page, "display-name");
  await page.getByRole("button", { name: "Done" }).click();

  const board = page.getByRole("region", { name: "This week" });
  for (const size of ["standard", "xl"]) {
    for (const theme of ["light", "dark"]) {
      for (const stop of STOPS) {
        await moveClock(page, stop.at);
        await change(page, { theme, text_size: size });
        await page.reload();
        await expect(board).toBeVisible();
        await shot(page, `board-${size}-${theme}-${stop.name}`);
      }
    }
  }

  // Settings at 16:10 on Auto, while there's no PIN yet (the screen opens them itself).
  await change(page, { theme: "auto", text_size: "standard" });
  await moveClock(page, STOPS[1]?.at ?? "");
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  for (const { key, title } of PAGES) {
    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
    await shot(page, `settings-${key}`);
  }
  await page
    .getByRole("navigation", { name: "Settings" })
    .getByRole("link", { name: "Family", exact: true })
    .click();
  await page.getByRole("button", { name: "Change Mia" }).click();
  await expect(page.getByRole("dialog", { name: "Change Mia" })).toBeVisible();
  await shot(page, "settings-change-a-person");

  // Night: 11:30 PM inside a 10 PM to 6 AM schedule.
  await change(page, { sleep_from: "22:00", sleep_to: "06:00", sleep_mode: "dim_clock" });
  await moveClock(page, NIGHT);
  await page.goto("/display");
  await expect(
    page.getByRole("button", { name: "The screen is sleeping. Tap to wake it." }),
  ).toBeVisible();
  await shot(page, "night");
  await change(page, { sleep_from: null, sleep_to: null });

  // The PIN dialog, with a PIN set.
  const pin = await page.request.put("/api/auth/pin", { headers: CSRF, data: { pin: PIN } });
  expect(pin.status()).toBe(204);
  await moveClock(page, STOPS[1]?.at ?? "");
  await page.goto("/display");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Parent PIN" })).toBeVisible();
  await shot(page, "pin");
});

test("a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones");
  test.setTimeout(240_000);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await resetServer(page.request);
    await page.context().clearCookies();
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Welcome to Sunroom" })).toBeVisible();
    await shot(page, `setup-welcome-${scheme}`);
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByLabel("Household password").fill(PASSWORD);
    await shot(page, `setup-password-${scheme}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Household name").fill("Sample Family");
    await shot(page, `setup-household-${scheme}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Your name").fill("Ana");
    await page.getByRole("button", { name: "Add me" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Mia");
    await page.getByRole("button", { name: "Kid" }).click();
    await page.getByRole("button", { name: "Add another" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Mia" })).toBeVisible();
    await shot(page, `setup-people-${scheme}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await shot(page, `setup-pin-${scheme}`);
    await page.getByRole("button", { name: "Later" }).click();
    await shot(page, `setup-pair-${scheme}`);
    await page.getByRole("button", { name: "Do this later" }).click();
    await shot(page, `setup-done-${scheme}`);
    await page.getByRole("button", { name: "Open Sunroom" }).click();
    await expect(page.getByRole("heading", { name: "Up next" })).toBeVisible();
    await shot(page, `today-${scheme}`);
    await page.getByRole("link", { name: "Calendar" }).click();
    await expect(page.getByRole("list", { name: "This week" })).toBeVisible();
    await shot(page, `calendar-${scheme}`);
    await page.getByRole("link", { name: "More" }).click();
    await shot(page, `more-${scheme}`);
    await page.getByRole("link", { name: "Pair a display" }).click();
    await shot(page, `pair-a-display-${scheme}`);
    await page.goto("/who?from=more");
    await shot(page, `who-${scheme}`);
    for (const { key, title } of PAGES) {
      await page.goto(`/settings/${key}`);
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      await shot(page, `settings-${key}-${scheme}`);
    }
    await page.goto("/settings/family");
    await page.getByRole("button", { name: "Change Mia" }).click();
    await expect(page.getByRole("dialog", { name: "Change Mia" })).toBeVisible();
    await shot(page, `settings-change-a-person-${scheme}`);
    await page.goto("/settings/devices");
    await page.getByRole("button", { name: "Add a phone" }).click();
    await expect(page.getByRole("dialog", { name: "Add a phone" })).toBeVisible();
    await shot(page, `settings-add-a-phone-${scheme}`);
    await page.goto("/install?from=more");
    await shot(page, `install-${scheme}`);
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await expect(page.getByLabel("Household password")).toBeVisible();
    await shot(page, `sign-in-${scheme}`);
  }
});

test("a laptop", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "a laptop");
  test.setTimeout(240_000);
  await seed(page.request);
  await page.goto("/sign-in");
  await shot(page, "sign-in");
  await signInPhone(page);
  for (const theme of ["light", "dark"]) {
    for (const stop of STOPS) {
      await moveClock(page, stop.at);
      await change(page, { theme });
      await page.reload();
      await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
      await shot(page, `board-${theme}-${stop.name}`);
    }
  }
  await change(page, { theme: "auto" });
  await page.getByRole("button", { name: "Settings" }).click();
  for (const { key, title } of PAGES) {
    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
    await shot(page, `settings-${key}`);
  }
});
