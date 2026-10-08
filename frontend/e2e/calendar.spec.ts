/**
 * The calendar from end to end (PLAN §15 M1): quick add on the wall screen, the chip in its day
 * in the person's color, a phone seeing it within 3 seconds, a "this and the ones after" change
 * and its Undo, and a drag that Undo puts back. Synthetic data only; the server's clock is set to
 * Wednesday, October 7, 2026, 10:00 AM in the household's zone (New York).
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, phone, seed, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

/** The toast that says `message`, for its Undo. */
function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

/** A long press (the board's drag sensor waits 400 ms), then a slow move and a drop. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error("nothing to drag, or nowhere to drop it");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 3, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p, with a phone");
  const moved = await request.post("/api/_test/clock", {
    headers: CSRF,
    data: { set: WEDNESDAY_10AM },
  });
  expect(moved.status()).toBe(204);
  await seed(request);
});

test("quick add on the wall, seen on a phone, changed and undone, dragged and put back", async ({
  page,
  browser,
  watch,
}) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This week" });
  await expect(board.locator("[aria-current=date]")).toContainText("Wed");

  // A phone, open on its Calendar: Thursday is tomorrow.
  const { page: phonePage, context } = await phone(browser, watch);
  await signInPhone(phonePage);
  await phonePage.getByRole("link", { name: "Calendar" }).click();
  const thursdayOnPhone = phonePage.getByRole("region", { name: /^Thu, Oct 8/ });
  await expect(thursdayOnPhone).toContainText("Soccer practice");

  // Quick add from the rail.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add" });
  await add.getByLabel("What, when, who").fill("Dentist Thu 2:30pm Mia");
  await expect(add).toContainText("Dentist · Thu, Oct 8 · 2:30 PM · 1 hour · Mia");
  await add.getByRole("button", { name: "Add event" }).click();
  await expect(add).toBeHidden();
  const dentist = board.getByRole("button", {
    name: "Dentist, 2:30 to 3:30 PM, Mia, Thursday October 8",
  });
  await expect(dentist).toBeVisible();
  await expect(dentist).toHaveAttribute("data-person", "rose");
  await expect(board.locator('[data-day="2026-10-08"]')).toContainText("Dentist");
  await expect(toast(page, "Added Dentist")).toBeVisible();

  // The phone sees it within 3 seconds, without a reload.
  await expect(thursdayOnPhone).toContainText("Dentist", { timeout: 3_000 });

  // Change Thursday's soccer practice and the ones after; Tuesday's stays as it was.
  await board
    .getByRole("button", { name: /^Soccer practice, 4:00 to 5:00 PM, Mia, Thursday October 8/ })
    .click();
  const sheet = page.getByRole("dialog", { name: "Soccer practice" });
  await expect(sheet).toContainText("Every week on Tue and Thu");
  await sheet.getByRole("button", { name: "Change" }).click();
  const editor = page.getByRole("dialog", { name: "Change" });
  await editor.getByLabel("Title").fill("Soccer training");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("dialog", { name: "Change which?" })
    .getByRole("button", { name: "This and the ones after" })
    .click();
  await expect(
    board.getByRole("button", { name: /^Soccer training, .*Thursday October 8/ }),
  ).toBeVisible();
  await expect(
    board.getByRole("button", { name: /^Soccer practice, .*Tuesday October 6/ }),
  ).toBeVisible();
  await expect(thursdayOnPhone).toContainText("Soccer training", { timeout: 3_000 });

  // Undo puts the series back together.
  await toast(page, "Changes saved").getByRole("button", { name: "Undo" }).click();
  await expect(
    board.getByRole("button", { name: /^Soccer practice, .*Thursday October 8/ }),
  ).toBeVisible();
  await expect(board.getByRole("button", { name: /^Soccer training/ })).toHaveCount(0);
  await expect(thursdayOnPhone).not.toContainText("Soccer training", { timeout: 3_000 });

  // Drag the vet from Wednesday to Friday, then Undo moves it back.
  const vet = board.getByRole("button", { name: /^Vet, 9:00 to 9:30 AM, Ana, Wednesday/ });
  await drag(page, vet, board.locator('[data-day="2026-10-09"]'));
  await expect(
    board.getByRole("button", { name: /^Vet, 9:00 to 9:30 AM, Ana, Friday October 9/ }),
  ).toBeVisible();
  await toast(page, "Moved Vet to Fri").getByRole("button", { name: "Undo" }).click();
  await expect(
    board.getByRole("button", { name: /^Vet, 9:00 to 9:30 AM, Ana, Wednesday October 7/ }),
  ).toBeVisible();

  await context.close();
});

test("the views, the event sheet and Recently removed", async ({ page }) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This week" });
  await expect(board).toBeVisible();

  // The Today panel: Up next is the piano lesson at 3:30 PM.
  const today = page.getByRole("complementary", { name: "Today" });
  await expect(today.getByRole("region", { name: "Up next" })).toContainText("Piano lesson");

  // Day: the vet is over, free time folds into one line.
  await page.getByRole("button", { name: "Day", exact: true }).click();
  const day = page.getByRole("region", { name: "Wed, Oct 7" });
  await expect(day).toContainText("Vet");
  await expect(day.getByRole("button", { name: /^free until 3:30 PM/ })).toBeVisible();

  // Month: a cell opens its day.
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const month = page.getByRole("region", { name: "October 2026" });
  await month.getByRole("button", { name: /^Fri 9: .*Pajama day/ }).click();
  await expect(page.getByRole("region", { name: "Fri, Oct 9" })).toContainText("Pajama day");

  // Who's doing what: a column per person, Everyone first.
  await page.getByRole("button", { name: "Who's doing what", exact: true }).click();
  const people = page.getByRole("region", { name: "Who's doing what" });
  await expect(people.getByRole("region", { name: "Ana" })).toContainText("Vet");
  await expect(people.getByRole("region", { name: "Leo" })).toContainText("Piano lesson");

  // Back to the week; remove the vet, then put it back from Settings.
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await board.getByRole("button", { name: /^Vet, / }).click();
  const sheet = page.getByRole("dialog", { name: "Vet" });
  await sheet.getByRole("button", { name: "Remove" }).click();
  await expect(sheet).toBeHidden();
  await expect(toast(page, "Removed Vet")).toBeVisible();
  await expect(board.getByRole("button", { name: /^Vet, / })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await page
    .getByRole("navigation", { name: "Settings" })
    .getByRole("link", { name: "Household", exact: true })
    .click();
  await page.getByRole("button", { name: "Put back Vet" }).click();
  await expect(toast(page, "Put back Vet")).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(board.getByRole("button", { name: /^Vet, / })).toBeVisible();
});
