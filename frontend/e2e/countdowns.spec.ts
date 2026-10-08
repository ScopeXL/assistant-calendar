/**
 * Countdowns end to end (PLAN §15 M4, UX §4 "Countdowns room"): Coming up on the Today panel
 * counts down to Mia's birthday from Family; "Add a countdown" from an event's sheet; on the
 * day the panel says so; and a surprise stays off the wall but shows on a phone. The server's
 * clock reads Wednesday, October 7, 2026 in New York. Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, phone, seed, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";
const MIAS_BIRTHDAY_10AM = "2026-10-19T14:00:00Z";

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
});

test("Coming up counts down to a birthday from Family", async ({ page, request }) => {
  await seed(request);
  await pairWall(page);
  const upcoming = await page.request.get("/api/countdowns/upcoming");
  expect(upcoming.ok()).toBe(true);
  const items = ((await upcoming.json()) as { items: { title: string; kind: string }[] }).items;
  expect(items).toContainEqual(
    expect.objectContaining({ kind: "birthday", title: "Mia's birthday" }),
  );

  await page.goto("/display");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp).toContainText("Grandma visits · 5 days");
  await expect(comingUp).toContainText("Mia's birthday · 12 days");
  await comingUp.getByRole("button", { name: /Mia's birthday/ }).click();
  await expect(page.getByRole("heading", { name: "Countdowns", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Countdowns" }).getByRole("button", { name: /Leo's birthday/ }),
  ).toBeVisible();
});

test("an event's sheet adds a countdown to it", async ({ page, request }) => {
  await seed(request);
  await pairWall(page);
  await page.goto("/display");
  await page
    .getByRole("button", { name: /^Pajama day/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a countdown" }).click();
  const add = page.getByRole("dialog", { name: "Add" });
  await expect(add.getByRole("button", { name: "Countdown", pressed: true })).toBeVisible();
  await expect(add.getByLabel("What it counts down to")).toHaveValue("Pajama day");
  await add.getByRole("button", { name: "Add countdown" }).click();
  await expect(toast(page, "Added Pajama day")).toBeVisible();
  await page.goto("/countdowns");
  const tiles = page.getByRole("list", { name: "Countdowns" });
  await expect(tiles.getByRole("button", { name: /Pajama day/ })).toContainText("2 days");
});

test("on the day, the Today panel says so", async ({ page, request }) => {
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: MIAS_BIRTHDAY_10AM } });
  await seed(request);
  await pairWall(page);
  await page.goto("/display");
  await expect(page.getByRole("region", { name: "Coming up" })).toContainText(
    "Today: Mia's birthday!",
  );
});

test("a surprise stays off the wall and shows on a phone", async ({
  page,
  request,
  browser,
  watch,
}) => {
  await seed(request);
  await pairWall(page);
  await page.goto("/countdowns");
  const tiles = page.getByRole("list", { name: "Countdowns" });
  await expect(tiles.getByRole("button", { name: /Camping trip/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /surprise party/ })).toHaveCount(0);
  const { context, page: sam } = await phone(browser, watch);
  await signInPhone(sam, "Sam");
  await sam.goto("/countdowns");
  await expect(
    sam.getByRole("list", { name: "Countdowns" }).getByRole("button", { name: /surprise party/ }),
  ).toBeVisible();
  await context.close();
});
