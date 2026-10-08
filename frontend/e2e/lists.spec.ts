/**
 * Lists end to end (PLAN §15 M3, UX §4 "Lists room", §6 "Groceries from a phone to the
 * display"): items added on the wall (commas make several, a Usual adds with one tap) show on a
 * phone within a second; checking one strikes it and folds it into Done; Clear done comes back
 * with Undo; New list opens the new list. Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, phone, seed, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

async function groceriesOnTheWall(page: Page): Promise<Locator> {
  await pairWall(page);
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /^Groceries/ }).click();
  await expect(page.getByRole("heading", { name: "Groceries", level: 1 })).toBeVisible();
  return page.getByRole("list", { name: "On Groceries" });
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
  await seed(request);
});

test("items added on the wall reach a phone, and checking one folds it into Done", async ({
  page,
  browser,
  watch,
}) => {
  const items = await groceriesOnTheWall(page);
  const { context, page: ana } = await phone(browser, watch);
  await signInPhone(ana, "Ana");
  await ana.getByRole("link", { name: "Lists" }).click();
  await ana.getByRole("link", { name: /^Groceries/ }).click();
  const onPhone = ana.getByRole("list", { name: "On Groceries" });
  await expect(onPhone).toContainText("Eggs");

  // Commas make several; a Usual adds with one tap.
  const field = page.getByLabel("Add to Groceries");
  await field.fill("Juice, crackers");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(toast(page, "Added 2 items")).toBeVisible();
  await page.getByRole("group", { name: "Usuals" }).getByRole("button", { name: "Apples" }).click();
  await expect(items).toContainText("Juice");
  await expect(items).toContainText("Crackers");
  await expect(items).toContainText("Apples");
  await expect(onPhone).toContainText("Crackers");
  await expect(onPhone).toContainText("Apples");

  // Checked: struck, then into Done; the phone sees it leave the list.
  await items.getByRole("checkbox", { name: /^Eggs/ }).click();
  await expect(toast(page, "Checked off Eggs")).toBeVisible();
  await expect(items.getByRole("checkbox", { name: /^Eggs/ })).toHaveCount(0);
  await expect(onPhone.getByRole("checkbox", { name: /^Eggs/ })).toHaveCount(0);
  await context.close();
});

test("Clear done comes back with Undo", async ({ page }) => {
  await groceriesOnTheWall(page);
  await expect(page.getByRole("region", { name: "Done" })).toContainText("Bread");
  await page.getByRole("button", { name: "Clear done" }).click();
  await expect(toast(page, "Cleared 1 done item")).toBeVisible();
  await expect(page.getByRole("region", { name: "Done" })).toHaveCount(0);
  await toast(page, "Cleared 1 done item").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("region", { name: "Done" })).toContainText("Bread");
});

test("New list makes it from a chip and opens it", async ({ page }) => {
  await pairWall(page);
  await page.goto("/lists");
  await page.getByRole("button", { name: "New list" }).click();
  await page
    .getByRole("dialog", { name: "New list" })
    .getByRole("button", { name: "Pharmacy" })
    .click();
  await expect(page.getByRole("heading", { name: "Pharmacy", level: 1 })).toBeVisible();
  await expect(page.getByText("Nothing on Pharmacy yet. Add the first thing.")).toBeVisible();
});
