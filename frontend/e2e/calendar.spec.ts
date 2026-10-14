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
  const board = page.getByRole("region", { name: "This Week" });
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
  // What was typed fills the rows: the title that's left, the day, the time, how long and who.
  await expect(add).toContainText('Saved as "Dentist"');
  const row = (name: string) => add.getByRole("group", { name, exact: true });
  const pressed = (group: string, name: string) =>
    expect(row(group).getByRole("button", { name, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  await pressed("Day", "Thu, Oct 8");
  await pressed("Who", "Mia");
  // Time, How long and Repeats each say what's chosen on one button (ADR 0030): no row of
  // likely times, no nine chips of repeats.
  await expect(add.getByRole("button", { name: "Time: 2:30 PM" })).toBeVisible();
  await expect(add.getByRole("button", { name: "All day" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(add.getByRole("button", { name: "How long: 1 hour" })).toBeVisible();
  await expect(add.getByRole("button", { name: "Repeats: Doesn't repeat" })).toBeVisible();
  await expect(add.getByRole("button", { name: "9:00 AM" })).toHaveCount(0);
  // The form is in three parts: the first needs no heading, the others say what they are.
  await expect(add.getByRole("region", { name: "What and Who" })).toBeVisible();
  await expect(add.getByRole("heading", { name: "When" })).toBeVisible();
  await expect(add.getByRole("heading", { name: "Details" })).toBeAttached();
  // The kinds of thing to add are one row, and the button stays in view above the keyboard.
  const kinds = await row("What to add")
    .getByRole("button")
    .evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().y)));
  expect(new Set(kinds).size).toBe(1);
  await expect(add.getByRole("button", { name: "Add Event" })).toBeInViewport();
  await add.getByRole("button", { name: "Add Event" }).click();
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
  await editor.getByRole("button", { name: "Save Changes" }).click();
  await page
    .getByRole("dialog", { name: "Change which?" })
    .getByRole("button", { name: "This and the Ones After" })
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

test("the views, the event sheet and Recently Removed", async ({ page }) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  await expect(board).toBeVisible();

  // The Today panel: Up next is the piano lesson at 3:30 PM.
  const today = page.getByRole("complementary", { name: "Today" });
  await expect(today.getByRole("region", { name: "Up next" })).toContainText("Piano lesson");

  // Day: the vet is over, free time folds into one line. The view names its own day: the
  // header doesn't (ADR 0030).
  await page.getByRole("button", { name: "Day", exact: true }).click();
  const day = page.getByRole("region", { name: "Wed, Oct 7" });
  await expect(day).toContainText("Wednesday, October 7");
  await expect(page.getByRole("banner")).not.toContainText("October");
  await expect(day).toContainText("Vet");
  await expect(day.getByRole("button", { name: /^free until 3:30 PM/ })).toBeVisible();

  // Month: a cell opens its day.
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const month = page.getByRole("region", { name: "October 2026" });
  await expect(month.getByText("October 2026", { exact: true })).toBeVisible();
  await month.getByRole("button", { name: /^Fri 9: .*Pajama day/ }).click();
  await expect(page.getByRole("region", { name: "Fri, Oct 9" })).toContainText("Pajama day");

  // People: a column per person, Everyone first. Nothing to filter there.
  await page.getByRole("button", { name: "People", exact: true }).click();
  const people = page.getByRole("region", { name: "People" });
  await expect(page.getByRole("banner").getByRole("button", { name: /^Filter/ })).toHaveCount(0);
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
    .getByRole("link", { name: "Recently Removed", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Recently Removed", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Put back Vet" }).click();
  await expect(toast(page, "Put back Vet")).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(board.getByRole("button", { name: /^Vet, / })).toBeVisible();
});

test("Filter is one button in the header: several people, a tap elsewhere, Everyone", async ({
  page,
}) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  const header = page.getByRole("banner");
  await expect(board.getByRole("button", { name: /^Vet, / })).toBeVisible();
  // No row over the days any more: the board starts under the header.
  await expect(page.getByRole("group", { name: "Show" })).toHaveCount(0);
  // A chip that isn't one of the chosen people's fades; it keeps its words.
  const faded = (name: RegExp) =>
    board
      .getByRole("button", { name })
      .first()
      .locator("xpath=ancestor::*[contains(@class, 'opacity-30')]");
  await header.getByRole("button", { name: "Filter", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Filter" });
  const everyone = menu.getByRole("menuitemradio", { name: "Everyone" });
  await expect(everyone).toHaveAttribute("aria-checked", "true");
  await expect(everyone).toBeFocused();
  // Choosing a person keeps the menu open for the next, and the board already follows.
  await menu.getByRole("menuitemcheckbox", { name: "Mia" }).click();
  await expect(menu).toBeVisible();
  await expect(faded(/^Vet, /)).toHaveCount(1);
  await expect(faded(/^Soccer practice, /)).toHaveCount(0);
  await expect(faded(/^Piano lesson, /)).toHaveCount(1);
  await menu.getByRole("menuitemcheckbox", { name: "Leo" }).click();
  await expect(faded(/^Piano lesson, /)).toHaveCount(0);
  // Everyone's events always show (the seed's garbage night is nobody's in particular).
  await expect(faded(/^Garbage night/)).toHaveCount(0);
  const chosen = header.getByRole("button", { name: "Filter: Mia, Leo" });
  await expect(chosen).toHaveAttribute("aria-expanded", "true");
  // A tap on the board closes the menu and does nothing else: no event sheet, no Add panel.
  await board.getByRole("button", { name: /^Vet, / }).click();
  await expect(menu).toBeHidden();
  await page.waitForTimeout(300);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The next tap is an ordinary one again.
  await board.getByRole("button", { name: /^Vet, / }).click();
  const sheet = page.getByRole("dialog", { name: "Vet" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  // Escape closes it too, back to the button; the filter holds on the Day and Month views.
  await chosen.click();
  await expect(menu.getByRole("menuitemcheckbox", { name: "Mia" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(chosen).toBeFocused();
  await header.getByRole("button", { name: "Month", exact: true }).click();
  await expect(chosen).toBeVisible();
  await header.getByRole("button", { name: "Week", exact: true }).click();
  // Everyone clears the filter and closes the menu.
  await chosen.click();
  await everyone.click();
  await expect(menu).toBeHidden();
  await expect(header.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(faded(/^Vet, /)).toHaveCount(0);
});

test("times follow the household's zone and its 12- or 24-hour clock", async ({
  page,
  browser,
  watch,
}) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  // The visible now line (FitList keeps an invisible copy for measuring).
  const nowLabel = board.locator(".now-label:visible");
  await expect(nowLabel).toHaveText("now 10:00");

  // A parent's phone moves the household to Honolulu, where 14:00 UTC is 4:00 in the morning.
  const { page: phonePage, context } = await phone(browser, watch);
  await signInPhone(phonePage);
  const change = async (settings: Record<string, string>) => {
    const response = await phonePage.request.patch("/api/settings", {
      headers: CSRF,
      data: settings,
    });
    expect(response.status()).toBe(200);
  };
  await change({ timezone: "Pacific/Honolulu" });
  await expect(nowLabel).toHaveText("now 4:00", { timeout: 3_000 });

  // Back home, on the 24-hour clock: Thursday's soccer practice starts at 16:00.
  await change({ timezone: "America/New_York", time_format: "24h" });
  const soccer = board.getByRole("button", { name: /^Soccer practice, .*Thursday October 8/ });
  await expect(soccer).toContainText("16:00", { timeout: 3_000 });
  await expect(nowLabel).toHaveText("now 10:00");
  await context.close();
});

test("a birthday from Family is a chip in its person's color, and moves when it's changed", async ({
  page,
  browser,
  watch,
}) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  const thursday = board.locator('[data-day="2026-10-08"]');
  const friday = board.locator('[data-day="2026-10-09"]');
  // The seed's: Mia's birthday is on Friday, in her color, with no plugin needed.
  const onFriday = friday.getByRole("button", { name: /^Mia's birthday, all day, Mia/ });
  await expect(onFriday).toHaveAttribute("data-overlay", "birthdays");
  await expect(onFriday).toHaveAttribute("data-person", "rose");

  // A parent's phone moves it to Thursday: the wall follows within 3 seconds.
  const { page: phonePage, context } = await phone(browser, watch);
  await signInPhone(phonePage);
  await phonePage.goto("/settings/family");
  await phonePage.getByRole("button", { name: "Edit Mia" }).click();
  await phonePage.getByLabel("Birthday (optional)").fill("2017-10-08");
  await phonePage.getByRole("button", { name: "Save Changes" }).click();
  await expect(toast(phonePage, "Changes saved")).toBeVisible();
  const onThursday = thursday.getByRole("button", { name: /^Mia's birthday/ });
  await expect(onThursday).toBeVisible({ timeout: 3_000 });
  await expect(friday.getByRole("button", { name: /^Mia's birthday/ })).toHaveCount(0);

  // A tap opens its sheet, read only, saying where it comes from.
  await onThursday.click();
  const sheet = page.getByRole("dialog", { name: "Mia's birthday" });
  await expect(sheet).toContainText("Thu, Oct 8 · all day");
  await expect(sheet).toContainText("From Mia's birthday in Settings → Family.");
  await expect(sheet.getByRole("button", { name: "Change" })).toHaveCount(0);
  await context.close();
});

test("an event added from a phone eases onto the wall, and one removed fades away", async ({
  page,
  browser,
  watch,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  await expect(board.getByRole("button", { name: /^Vet, / })).toBeVisible();
  // Nothing arrives on first paint.
  await expect(board.locator("[data-arrive]")).toHaveCount(0);
  // Nor when the week is paged: the whole week slides in from its side instead.
  await page.getByRole("button", { name: "Next week" }).click();
  const body = board.locator("[data-page]");
  await expect(body).toHaveAttribute("data-page", "next");
  expect(await body.evaluate((node) => getComputedStyle(node).animationName)).toMatch(
    /^page-next-/,
  );
  await page.getByRole("button", { name: "This Week" }).click();
  await expect(body).toHaveAttribute("data-page", "prev");
  await expect(board.getByRole("button", { name: /^Vet, / })).toBeVisible();
  await expect(board.locator("[data-arrive]")).toHaveCount(0);

  // A parent's phone adds an event: its chip, and only it, eases in.
  const { page: phonePage, context } = await phone(browser, watch);
  await signInPhone(phonePage);
  const added = await phonePage.request.post("/api/calendar/events", {
    headers: CSRF,
    data: { title: "Library day", start_date: "2026-10-08" },
  });
  expect(added.status()).toBe(201);
  const { event } = (await added.json()) as { event: { id: string } };
  const chip = board.getByRole("button", { name: /^Library day/ });
  await expect(chip).toHaveAttribute("data-arrive", "", { timeout: 3_000 });
  expect(await chip.evaluate((node) => getComputedStyle(node).animationName)).toBe("arrive");
  await expect(board.locator("[data-arrive]")).toHaveCount(1);
  // The mark goes once it has arrived, so drawing the board again doesn't replay it.
  await expect(board.locator("[data-arrive]")).toHaveCount(0, { timeout: 3_000 });

  // Removed from the phone: the chip fades and shrinks before it goes (motion, under the CSP).
  await page.evaluate(() => {
    const seen = window as unknown as { faded?: boolean };
    seen.faded = false;
    const chip = document.querySelector('[data-chip][aria-label^="Library day"]');
    const watch = () => {
      const box = chip?.parentElement?.parentElement;
      if (box && Number(getComputedStyle(box).opacity) < 1) seen.faded = true;
      if (chip?.isConnected) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  const removed = await phonePage.request.delete(`/api/calendar/events/${event.id}`, {
    headers: CSRF,
  });
  expect(removed.ok()).toBe(true);
  // Gone for a reader and a finger at once (it's inert while it fades), then from the page.
  await expect(chip).toHaveCount(0, { timeout: 3_000 });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { faded?: boolean }).faded))
    .toBe(true);
  await expect(page.locator('[data-chip][aria-label^="Library day"]')).toHaveCount(0);

  // With Reduce motion on (Settings → Display), a newcomer has no animation at all.
  const calm = await phonePage.request.patch("/api/settings", {
    headers: CSRF,
    data: { display_reduce_motion: true },
  });
  expect(calm.ok()).toBe(true);
  await expect(page.locator("html[data-reduce-motion]")).toHaveCount(1, { timeout: 3_000 });
  const again = await phonePage.request.post("/api/calendar/events", {
    headers: CSRF,
    data: { title: "Dentist", start_date: "2026-10-08" },
  });
  expect(again.status()).toBe(201);
  const calmChip = board.getByRole("button", { name: /^Dentist/ });
  await expect(calmChip).toBeVisible({ timeout: 3_000 });
  expect(await calmChip.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await context.close();
});
