/**
 * Lists end to end (PLAN §15 M3, UX §4 "Lists room", §6 "Groceries from a phone to the
 * display"): items added on the wall (commas make several, a Usual adds with one tap) show on a
 * phone within a second; checking one strikes it and folds it into Done; Clear done comes back
 * with Undo; New list opens the new list; a long press on a tile opens Change list. Synthetic data only.
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
  test.skip(
    testInfo.project.name !== "display-1080p" && testInfo.project.name !== "phone-chromium",
    "the wall screen at 1080p, and a phone",
  );
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
  await seed(request);
});

function onTheWall(): void {
  test.skip(test.info().project.name !== "display-1080p", "the wall screen at 1080p");
}

function onAPhone(): void {
  test.skip(test.info().project.name !== "phone-chromium", "a phone");
}

/** A finger's swipe to the left across a row (a press, three moves, a release). */
async function swipeLeft(page: Page, row: Locator): Promise<void> {
  const box = await row.boundingBox();
  if (!box) throw new Error("no row to swipe");
  const x = box.x + box.width * 0.75;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const step of [40, 80, 120]) await page.mouse.move(x - step, y);
  await page.mouse.up();
}

test("items added on the wall reach a phone, and checking one folds it into Done", async ({
  page,
  browser,
  watch,
}) => {
  onTheWall();
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
  onTheWall();
  await groceriesOnTheWall(page);
  await expect(page.getByRole("region", { name: "Done" })).toContainText("Bread");
  await page.getByRole("button", { name: "Clear Done" }).click();
  await expect(toast(page, "Cleared 1 done item")).toBeVisible();
  await expect(page.getByRole("region", { name: "Done" })).toHaveCount(0);
  await toast(page, "Cleared 1 done item").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("region", { name: "Done" })).toContainText("Bread");
});

test("New list is one field, a usual name fills it, and the list opens once made", async ({
  page,
}) => {
  onTheWall();
  await pairWall(page);
  await page.goto("/lists");
  await page.getByRole("button", { name: "New List" }).click();
  const panel = page.getByRole("dialog", { name: "New List" });
  await expect(panel.getByRole("textbox")).toHaveCount(1);
  const add = panel.getByRole("button", { name: "Add List" });
  await expect(add).toBeDisabled();
  await panel.getByRole("button", { name: "Pharmacy" }).click();
  await expect(panel.getByLabel("Name")).toHaveValue("Pharmacy");
  await add.click();
  await expect(page.getByRole("heading", { name: "Pharmacy", level: 1 })).toBeVisible();
  await expect(page.getByText("Nothing on Pharmacy yet. Add the first thing.")).toBeVisible();
});

test("an empty Lists room says what goes there, with one big New List", async ({ page }) => {
  onTheWall();
  await pairWall(page);
  const lists = (await (await page.request.get("/api/lists")).json()) as { id: string }[];
  for (const list of lists) {
    const gone = await page.request.delete(`/api/lists/${list.id}`, { headers: CSRF });
    expect(gone.ok()).toBe(true);
  }
  await page.goto("/lists");
  // An icon, a short line, a note and one big button, centred in the room (ADR 0032).
  const empty = page.locator("[data-empty]");
  await expect(empty).toContainText("No lists yet");
  await expect(empty).toContainText(
    "everyone sees them on paired screens and on their own devices",
  );
  const make = empty.getByRole("button", { name: "New List" });
  const button = await make.boundingBox();
  const room = await page.getByRole("region", { name: "Lists" }).boundingBox();
  expect(button?.height ?? 0).toBeGreaterThanOrEqual(64);
  const middle = (box: { x: number; width: number } | null) => (box ? box.x + box.width / 2 : 0);
  expect(Math.abs(middle(button) - middle(room))).toBeLessThanOrEqual(2);
  await make.click();
  await expect(page.getByRole("dialog", { name: "New List" })).toBeVisible();
});

test("a long press on a tile opens Change list, and doesn't open the list", async ({ page }) => {
  onTheWall();
  await pairWall(page);
  await page.goto("/lists");
  const tile = page.getByRole("link", { name: /^Groceries/ });
  await tile.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const panel = page.getByRole("dialog", { name: "Change Groceries" });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/lists$/);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
  // A tap still opens it.
  await tile.click();
  await expect(page.getByRole("heading", { name: "Groceries", level: 1 })).toBeVisible();
});

test("an item's row opens its sheet, and Remove takes it off the list with Undo", async ({
  page,
}) => {
  onTheWall();
  const items = await groceriesOnTheWall(page);
  const eggs = items.getByRole("button", { name: /^Eggs/ });
  // The row says it opens: a chevron at its end (ADR 0036).
  await expect(eggs.locator("svg")).toHaveCount(1);
  await eggs.click();
  const sheet = page.getByRole("dialog", { name: "Eggs" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Remove Eggs" }).click();
  await expect(sheet).toBeHidden();
  await expect(items.getByRole("button", { name: /^Eggs/ })).toHaveCount(0);
  await toast(page, "Removed Eggs").getByRole("button", { name: "Undo" }).click();
  await expect(items.getByRole("button", { name: /^Eggs/ })).toBeVisible();
});

test("a phone: a swiped row shows Remove, for an item and for a whole list", async ({ page }) => {
  onAPhone();
  await signInPhone(page);
  await page.getByRole("link", { name: "Lists" }).click();
  await page.getByRole("link", { name: /^Groceries/ }).click();
  const items = page.getByRole("list", { name: "On Groceries" });
  await swipeLeft(page, items.getByRole("button", { name: /^Eggs/ }));
  // The swipe opened nothing; Remove is there to tap, and does what the sheet's does.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove Eggs" }).click();
  await expect(toast(page, "Removed Eggs").getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(items.getByRole("button", { name: /^Eggs/ })).toHaveCount(0);

  // On the list of lists: Groceries still has things on it, so its Remove asks first.
  await page.getByRole("link", { name: "Lists", exact: true }).click();
  const groceries = page.getByRole("link", { name: /^Groceries/ });
  await swipeLeft(page, groceries);
  await expect(page).toHaveURL(/\/lists$/);
  await page.getByRole("button", { name: "Remove Groceries" }).click();
  const panel = page.getByRole("dialog", { name: "Change Groceries" });
  await expect(panel).toContainText(/Groceries still has \d+ things? on it\./);
  await expect(panel.getByRole("button", { name: "Keep Groceries" })).toBeVisible();
  await panel.getByRole("button", { name: "Keep Groceries" }).click();
  await expect(panel.getByRole("button", { name: "Remove Groceries" })).toBeVisible();
});
