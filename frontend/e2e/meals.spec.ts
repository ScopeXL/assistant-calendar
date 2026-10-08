/**
 * Meals end to end (PLAN §15 M4, UX §4 "Meals room"): Tonight on the Today panel; a dinner added
 * on the wall from a saved meal; Swap days; Copy last week with Undo; and a saved meal's
 * ingredients put on Groceries. The server's clock reads Wednesday, October 7, 2026 in New
 * York; the Sample Family's meals come from the seed. Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, seed, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

async function mealsRoom(page: Page): Promise<Locator> {
  await pairWall(page);
  await page.goto("/meals");
  await expect(page.getByRole("heading", { name: /^Meals · Oct 4/, level: 1 })).toBeVisible();
  return page.getByRole("table");
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
  await seed(request);
});

test("Tonight shows today's dinner, and a saved meal fills an empty day", async ({ page }) => {
  await pairWall(page);
  await page.goto("/display");
  const tonight = page.getByRole("region", { name: "Tonight" });
  await expect(tonight).toContainText("Tacos");
  await expect(tonight).toContainText("Sam cooks");

  const grid = await mealsRoom(page);
  await grid.getByRole("button", { name: "Add dinner on Sat, Oct 10" }).click();
  const panel = page.getByRole("dialog", { name: "Add dinner" });
  await panel.getByRole("button", { name: /Grilled cheese and soup/ }).click();
  await panel.getByRole("button", { name: "Add dinner" }).click();
  await expect(toast(page, "Added Grilled cheese and soup")).toBeVisible();
  await expect(grid.getByRole("row", { name: /Sat 10/ })).toContainText("Grilled cheese and soup");
});

test("Swap days trades two dinners, and Undo trades them back", async ({ page }) => {
  const grid = await mealsRoom(page);
  await grid.getByRole("button", { name: /Tacos/ }).click();
  const panel = page.getByRole("dialog", { name: /Tacos/ });
  await panel.getByRole("button", { name: "Swap days" }).click();
  await panel.getByRole("button", { name: "Thu, Oct 8" }).click();
  await expect(toast(page, "Swapped Tacos and Leftovers")).toBeVisible();
  await expect(grid.getByRole("row", { name: /Thu 8/ })).toContainText("Tacos");
  await expect(grid.getByRole("row", { name: /Wed 7/ })).toContainText("Leftovers");
  await toast(page, "Swapped Tacos and Leftovers").getByRole("button", { name: "Undo" }).click();
  await expect(grid.getByRole("row", { name: /Wed 7/ })).toContainText("Tacos");
});

test("Copy last week fills next week, and Undo empties it again", async ({ page }) => {
  const grid = await mealsRoom(page);
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("heading", { name: /^Meals · Oct 11/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Copy last week" }).click();
  await expect(toast(page, "Copied 6 meals")).toBeVisible();
  await expect(grid.getByRole("row", { name: /Wed 14/ })).toContainText("Tacos");
  await toast(page, "Copied 6 meals").getByRole("button", { name: "Undo" }).click();
  await expect(grid.getByRole("row", { name: /Wed 14/ })).not.toContainText("Tacos");
});

test("a saved meal's ingredients go on Groceries", async ({ page }) => {
  const grid = await mealsRoom(page);
  await grid.getByRole("button", { name: /Tacos/ }).click();
  await page
    .getByRole("dialog", { name: /Tacos/ })
    .getByRole("button", { name: "Add ingredients to Groceries" })
    .click();
  await expect(toast(page, "Added 5 items to Groceries")).toBeVisible();
  await page.goto("/lists");
  await page.getByRole("link", { name: /^Groceries/ }).click();
  await expect(page.getByRole("list", { name: "On Groceries" })).toContainText("Tortillas");
});
