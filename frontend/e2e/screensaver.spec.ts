/**
 * Photos and the screensaver end to end (PLAN §15 M4, UX §4 "Photos room", "Screensaver", §6
 * "Screensaver in and out"): after the idle minutes the photos fade in over the wall, uncropped,
 * with the clock band; a tap goes back to exactly where the wall was and presses nothing; a
 * parent's phone starts it; a phone adds a photo and removes it with Undo. The browser's clock
 * is Playwright's, so ten idle minutes take no time. Synthetic photos only (the seed draws them).
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, phone, seed, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";
// A 2 × 2 JPEG (synthetic: four flat colors), for the phone's upload.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

function saver(page: Page): Locator {
  return page.getByRole("button", { name: "Photos are showing. Tap to go back." });
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
  await seed(request);
});

test("the photos fade in after the idle minutes, and a tap goes back to where the wall was", async ({
  page,
}) => {
  await page.clock.install();
  await pairWall(page);
  // Rooms stay put while nobody touches the wall, so the screensaver finds Chores.
  const stay = await page.request.patch("/api/settings", {
    headers: CSRF,
    data: { display_return_minutes: 0 },
  });
  expect(stay.ok()).toBe(true);
  await page.goto("/chores");
  await expect(page.getByRole("heading", { name: "Chores · Today", level: 1 })).toBeVisible();
  await expect(saver(page)).toHaveCount(0);

  await page.clock.fastForward("10:30");
  await expect(saver(page)).toBeVisible();
  await expect(saver(page).locator("img").first()).toHaveJSProperty("complete", true);
  await expect(saver(page)).toContainText("Wednesday, Oct 7");

  // The waking tap lands on the saver, not on what's under it.
  await saver(page).click({ position: { x: 960, y: 300 } });
  await expect(saver(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chores · Today", level: 1 })).toBeVisible();
});

test("a parent's phone starts the screensaver on the wall", async ({ page, browser, watch }) => {
  await pairWall(page);
  await page.goto("/display");
  await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
  const { context, page: ana } = await phone(browser, watch);
  await signInPhone(ana, "Ana");
  await ana.goto("/photos");
  await ana.getByRole("button", { name: "Start screensaver" }).click();
  await expect(toast(ana, "Started the screensaver on the kitchen screen")).toBeVisible();
  await expect(saver(page)).toBeVisible();
  await context.close();
});

test("a phone adds a photo, and removes it with Undo", async ({ browser, watch }) => {
  const { context, page: ana } = await phone(browser, watch);
  await signInPhone(ana, "Ana");
  await ana.goto("/photos");
  const photos = ana.getByRole("list", { name: "Photos" }).getByRole("listitem");
  // The Sample Family's eight.
  const before = 8;
  await expect(photos).toHaveCount(before);
  await ana.getByLabel("Add photos").setInputFiles({
    name: "garden.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await expect(toast(ana, "Added 1 photo")).toBeVisible();
  await expect(photos).toHaveCount(before + 1);
  await photos.first().getByRole("button").click();
  await ana.getByRole("dialog", { name: "Photo" }).getByRole("button", { name: "Remove" }).click();
  await expect(toast(ana, "Removed the photo")).toBeVisible();
  await expect(photos).toHaveCount(before);
  await toast(ana, "Removed the photo").getByRole("button", { name: "Undo" }).click();
  await expect(photos).toHaveCount(before + 1);
  await context.close();
});
