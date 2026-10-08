/**
 * Accessibility on every main screen (PLAN §14.6, UX §1 and §10): no serious or critical axe
 * findings, in light and dark, on the wall screen (landscape and portrait), phones and a laptop.
 * Every tap target is at least 56 px on the wall screen and 44 px on a phone, with 8 px between
 * neighbours on a line; no typing field is under 16 px. Lesser axe findings are printed.
 * Synthetic data only.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import {
  expect,
  PASSWORD,
  PIN,
  scriptedAccount,
  seed,
  settled,
  signInPhone,
  test,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SETTINGS = [
  "Family",
  "Features",
  "Calendars & accounts",
  "Display",
  "Household",
  "Phones & screens",
  "Backup",
];
const CSRF = { "X-Sunroom": "1" };
// Wednesday, October 7, 2026, 10:00 AM in New York: the same week of events on every run.
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

// The screens at rest: with Reduce Motion nothing is caught halfway through an animation, which
// axe would read as low contrast.
test.use({ reducedMotion: "reduce" });

/** iPhones zoom into any typing field under 16 px: none may be smaller, anywhere. */
async function typingFieldsAtLeast16px(page: Page, where: string): Promise<void> {
  const small = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        "input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), select, textarea",
      ),
    )
      .filter((field) => {
        const box = field.getBoundingClientRect();
        return box.width > 1 && box.height > 1 && parseFloat(getComputedStyle(field).fontSize) < 16;
      })
      .map((field) => field.outerHTML.slice(0, 120)),
  );
  expect(small, `typing fields under 16 px on ${where}`).toEqual([]);
}

/**
 * Tap targets (UX §1): 56 px on the wall screen (and a laptop, which gets its shell), 44 px on a
 * phone; 8 px between neighbours on the same line. Links inside a sentence don't count, nor do
 * the options of one segmented control or one tab bar (marked data-segmented), which read as a
 * single control with large cells. A control covered where it would be tapped (a chip under the
 * open side panel, a row scrolled under the tab bar) still has to be big enough, but it isn't
 * anyone's neighbour until it's uncovered; nor is the board across the side panel's edge, whose
 * 24 px padding keeps its own controls clear of the board.
 */
async function tapTargets(page: Page, where: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const display = document.querySelector("[data-shell=display]") !== null;
    const least = display ? 56 : 44;
    // With a sheet or dialog open, the page behind it can't be tapped.
    const scope = document.querySelector("dialog:modal") ?? document;
    const controls = Array.from(
      scope.querySelectorAll("button, a[href], select, summary, [role=checkbox]"),
    ).filter((control) => {
      if (control.closest("[inert], [aria-hidden='true']")) return false;
      const style = getComputedStyle(control);
      const box = control.getBoundingClientRect();
      if (style.visibility === "hidden" || box.width <= 1 || box.height <= 1) return false;
      if (control.tagName === "A" && style.display === "inline") return false;
      return true;
    });
    const name = (control: Element) => {
      const box = control.getBoundingClientRect();
      const text = (control.getAttribute("aria-label") ?? control.textContent).trim().slice(0, 40);
      return `${control.tagName.toLowerCase()} "${text}" ${String(Math.round(box.width))}x${String(Math.round(box.height))}`;
    };
    const covered = (control: Element) => {
      const box = control.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return hit !== null && !control.contains(hit) && !hit.contains(control);
    };
    const found: string[] = [];
    for (const control of controls) {
      const box = control.getBoundingClientRect();
      if (box.width < least - 0.5 || box.height < least - 0.5) {
        found.push(`under ${String(least)} px: ${name(control)}`);
      }
    }
    const open = controls.filter((control) => !covered(control));
    for (const [index, a] of open.entries()) {
      const one = a.getBoundingClientRect();
      for (const b of open.slice(index + 1)) {
        if (a.contains(b) || b.contains(a)) continue;
        const segmented = a.closest("[data-segmented]");
        if (segmented && segmented === b.closest("[data-segmented]")) continue;
        if (a.closest("[data-panel]") !== b.closest("[data-panel]")) continue;
        const two = b.getBoundingClientRect();
        const shared = Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top);
        if (shared < Math.min(one.height, two.height) / 2) continue; // not on one line
        const gap = Math.max(two.left - one.right, one.left - two.right);
        if (gap < 7.5) found.push(`${String(Math.round(gap))} px apart: ${name(a)} and ${name(b)}`);
      }
    }
    return found;
  });
  expect(problems, `tap targets on ${where}`).toEqual([]);
}

async function check(page: Page, where: string): Promise<void> {
  await settled(page);
  await typingFieldsAtLeast16px(page, where);
  await tapTargets(page, where);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // A11Y_ALL=1 fails on every finding, for a full review; normally only serious and critical.
  const blocking = results.violations.filter(
    (violation) =>
      process.env.A11Y_ALL === "1" ||
      violation.impact === "serious" ||
      violation.impact === "critical",
  );
  for (const violation of results.violations) {
    if (blocking.includes(violation)) continue;
    console.log(`${where}: ${violation.impact ?? "?"} ${violation.id}: ${violation.help}`);
  }
  expect(
    blocking.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "?"}): ${violation.help} → ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    ),
    `axe on ${where}`,
  ).toEqual([]);
}

/** Open a side panel or sheet with a button, check it, close it. */
async function sheet(page: Page, open: string, where: string): Promise<void> {
  await page.getByRole("button", { name: open }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await check(page, where);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    });

    test("the first-run wizard on a phone", async ({ page, isMobile }) => {
      test.skip(!isMobile, "phones");
      await page.goto("/setup");
      await expect(page.getByRole("heading", { name: "Welcome to Sunroom" })).toBeVisible();
      await check(page, "setup: welcome");
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page.getByLabel("Household password")).toBeVisible();
      await check(page, "setup: password");
      await page.getByLabel("Household password").fill(PASSWORD);
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByRole("heading", { name: "Name your household" })).toBeVisible();
      await check(page, "setup: household");
      await page.getByLabel("Household name").fill("Sample Family");
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByRole("heading", { name: "Who lives here?" })).toBeVisible();
      await check(page, "setup: people");
      await page.getByLabel("Your name").fill("Ana");
      await page.getByRole("button", { name: "Add me" }).click();
      await expect(page.getByRole("button", { name: "Add another" })).toBeVisible();
      await check(page, "setup: people, one added");
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Set a parent PIN?" })).toBeVisible();
      await check(page, "setup: PIN");
      await page.getByRole("button", { name: "Later" }).click();
      await expect(page.getByRole("heading", { name: "Pair the kitchen screen" })).toBeVisible();
      await check(page, "setup: pair");
      await page.getByRole("button", { name: "Do this later" }).click();
      await expect(page.getByRole("heading", { name: "Bring in your calendars" })).toBeVisible();
      await check(page, "setup: calendars");
      await page.getByRole("button", { name: "Add a calendar" }).click();
      await expect(page.getByRole("dialog", { name: "Add an account" })).toBeVisible();
      await check(page, "setup: add an account");
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Skip for now" }).click();
      await expect(page.getByRole("heading", { name: "You’re set" })).toBeVisible();
      await check(page, "setup: done");
    });

    test("a phone, signed in", async ({ page, request, isMobile }) => {
      test.skip(!isMobile, "phones");
      await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
      await seed(request, { pin: PIN });
      await page.goto("/sign-in");
      await expect(page.getByLabel("Household password")).toBeVisible();
      await check(page, "sign in");
      await page.getByRole("button", { name: "Use a code from another phone" }).click();
      await check(page, "sign in with a code");
      await signInPhone(page);
      await check(page, "today");
      await page.goto("/who?from=more");
      await expect(page.getByRole("heading", { name: "Who’s using this phone?" })).toBeVisible();
      await check(page, "who's using this");
      await page.goto("/");
      await page.getByRole("link", { name: "Calendar" }).click();
      await expect(page.getByRole("group", { name: "Days" })).toBeVisible();
      await check(page, "calendar");
      await page.getByRole("button", { name: /^Vet, / }).click();
      await expect(page.getByRole("dialog", { name: "Vet" })).toBeVisible();
      await check(page, "calendar: event");
      await page
        .getByRole("dialog", { name: "Vet" })
        .getByRole("button", { name: "Close" })
        .click();
      await sheet(page, "Add", "calendar: add");
      for (const mode of ["Day", "Agenda", "Month"]) {
        await page.getByRole("button", { name: mode, exact: true }).click();
        await check(page, `calendar: ${mode.toLowerCase()}`);
      }
      await sheet(page, "October 2026", "calendar: month picker");
      await page.getByRole("link", { name: "More" }).click();
      await expect(page.getByRole("heading", { name: "More", level: 1 })).toBeVisible();
      await check(page, "more");
      await page.getByRole("link", { name: "Pair a display" }).click();
      await expect(page.getByRole("heading", { name: "Pair a display", level: 1 })).toBeVisible();
      await check(page, "pair a display");
      await scriptedAccount(page.request);
      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
      await check(page, "settings");
      for (const title of [...SETTINGS, "About"]) {
        await page.goto("/settings");
        await page.getByRole("link", { name: title, exact: true }).click();
        await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
        await check(page, `settings: ${title}`);
        if (title === "Family") await sheet(page, "Change Mia", "change a person");
        if (title === "Calendars & accounts") await sheet(page, "Add a calendar", "add a calendar");
        if (title === "Phones & screens") await sheet(page, "Add a phone", "add a phone");
      }
      await page.goto("/install?from=more");
      await expect(
        page.getByRole("heading", { name: "Put Sunroom on your home screen" }),
      ).toBeVisible();
      await check(page, "install");
    });

    test("the wall screen, from first light to Settings", async ({ page, request }, testInfo) => {
      test.skip(!testInfo.project.name.startsWith("display"), "the wall screen");
      await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
      await page.goto("/display");
      await expect(
        page.getByRole("heading", { name: "Set up Sunroom on your phone" }),
      ).toBeVisible();
      await check(page, "display: before setup");
      await seed(request, { pin: PIN });
      await page.reload();
      await expect(page.getByTestId("pair-code")).toBeVisible();
      await check(page, "display: pair this screen");
      await page.getByRole("button", { name: "Type the household password here instead" }).click();
      await page.getByLabel("Household password").click();
      await expect(page.getByRole("group", { name: "On-screen keyboard" })).toBeVisible();
      await check(page, "display: password and keyboard");
      await page.getByLabel("Household password").fill(PASSWORD);
      await page.getByRole("button", { name: "Pair this screen" }).click();
      await expect(page.getByRole("heading", { name: "Name this screen" })).toBeVisible();
      await check(page, "display: name this screen");
      await page.getByRole("button", { name: "Done" }).click();
      const board = page.getByRole("region", { name: "This week" });
      await expect(board).toBeVisible();
      await check(page, "display: board");
      await board.getByRole("button", { name: /^Soccer practice, .*Thursday/ }).click();
      await expect(page.getByRole("dialog", { name: "Soccer practice" })).toBeVisible();
      await check(page, "display: event");
      await page
        .getByRole("dialog", { name: "Soccer practice" })
        .getByRole("button", { name: "Close" })
        .click();
      await page.getByRole("button", { name: "Add", exact: true }).click();
      const add = page.getByRole("dialog", { name: "Add" });
      await add.getByLabel("What, when, who").fill("Dentist every Thu 2:30pm Mia");
      await add.getByRole("button", { name: "2:30 PM" }).click();
      await check(page, "display: add, the time picker");
      await add.getByRole("button", { name: "Every week on Thu" }).click();
      await check(page, "display: add, the repeat picker");
      await add.getByRole("button", { name: "Close" }).click();
      for (const view of ["Day", "Month", "Who's doing what"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await check(page, `display: ${view}`);
      }
      await page.getByRole("button", { name: "Week", exact: true }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Parent PIN" })).toBeVisible();
      await check(page, "display: PIN");
      const pin = page.getByRole("dialog", { name: "Parent PIN" });
      for (const digit of PIN) await pin.getByRole("button", { name: digit, exact: true }).click();
      await expect(pin).toBeHidden();
      await scriptedAccount(page.request); // the PIN's grant makes this screen a parent's for now
      for (const title of [...SETTINGS, "About"]) {
        await page
          .getByRole("navigation", { name: "Settings" })
          .getByRole("link", { name: title, exact: true })
          .click();
        await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
        await check(page, `display settings: ${title}`);
        if (title === "Family") await sheet(page, "Change Mia", "display: change a person");
        if (title === "Calendars & accounts") {
          await sheet(page, "Change Kids' activities", "display: change a calendar");
        }
      }
    });

    test("a laptop", async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "a laptop");
      await seed(request);
      await page.goto("/sign-in");
      await expect(page.getByLabel("Household password")).toBeVisible();
      await check(page, "laptop: sign in");
      await signInPhone(page);
      await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
      await check(page, "laptop: board");
      await page.getByRole("button", { name: "Settings" }).click();
      for (const title of [...SETTINGS, "About"]) {
        await page
          .getByRole("navigation", { name: "Settings" })
          .getByRole("link", { name: title, exact: true })
          .click();
        await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
        await check(page, `laptop settings: ${title}`);
      }
    });
  });
}
