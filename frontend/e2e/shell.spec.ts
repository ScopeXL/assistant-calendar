/**
 * The two shells at every size (ADR 0014, UX §3): the wall screen's rail and Today panel in
 * landscape, the Today band and bottom bar in portrait, a laptop in the display shell with its
 * own keyboard, phones with the tab bar. Nothing scrolls sideways. The evening dim on the wall,
 * and About's New versions on a phone. Synthetic data only.
 */
import type { Page } from "@playwright/test";

import { expect, pairWall, PASSWORD, seed, signInPhone, test, wall } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(0);
}

/** Every digit of the clock sits in a box of one width, so the time never jiggles (ADR 0021). */
async function steadyDigits(page: Page): Promise<void> {
  const widths = await page
    .getByRole("navigation", { name: "Rooms" })
    .locator(".digit")
    .evaluateAll((digits) =>
      digits.map((digit) => Math.round(digit.getBoundingClientRect().width)),
    );
  expect(widths.length).toBeGreaterThan(0);
  expect(new Set(widths).size).toBe(1);
}

test.describe("a phone", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, "phones");
  });

  test("moves between its tabs, and nothing scrolls sideways", async ({ page, request }) => {
    await seed(request);
    await signInPhone(page);
    await noSidewaysScroll(page, "Today");
    await expect(page.getByRole("link", { name: "Using this phone: Ana" })).toBeVisible();
    await page.getByRole("link", { name: "Calendar" }).click();
    await expect(page.getByRole("group", { name: "Days" })).toBeVisible();
    await noSidewaysScroll(page, "Calendar");
    await page.getByRole("link", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More", level: 1 })).toBeVisible();
    await noSidewaysScroll(page, "More");
    await page.getByRole("link", { name: "Settings" }).click();
    for (const title of ["Family", "Display", "Household", "Phones & Screens", "About"]) {
      await page.getByRole("link", { name: title, exact: true }).click();
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      await noSidewaysScroll(page, title);
      await page.getByRole("button", { name: "Back" }).click();
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    }
  });

  test("About says a new version is out once a parent turns the check on", async ({
    page,
    request,
  }) => {
    // The test server never asks GitHub: it makes up the next minor version.
    await seed(request);
    await signInPhone(page);
    await page.getByRole("link", { name: "More" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "About", exact: true }).click();
    const daily = page.getByRole("switch", { name: "Check for new versions daily" });
    await expect(daily).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Check now" })).toBeHidden();
    await daily.click();
    await expect(daily).toBeChecked();
    await page.getByRole("button", { name: "Check now" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is available" })).toHaveText(
      /^Sunroom \d+\.\d+\.0 is available\. In Sunroom's folder on the server, run docker compose pull, then docker compose up -d\.$/,
    );
  });

  test("pairs a wall screen from More", async ({ page, request, browser, watch }) => {
    await seed(request);
    const { page: screen, context } = await wall(browser, watch);
    await screen.goto("/display");
    const code = screen.getByTestId("pair-code");
    await expect(code).toBeVisible();
    await signInPhone(page);
    await page.getByRole("link", { name: "More" }).click();
    await page.getByRole("link", { name: "Pair a display" }).click();
    await page.getByLabel("The code on the screen").fill((await code.textContent()) ?? "");
    await page.getByRole("button", { name: "Pair", exact: true }).click();
    await expect(screen.getByRole("heading", { name: "Name this screen" })).toBeVisible();
    await screen.getByRole("button", { name: "Hallway" }).click();
    await screen.getByRole("button", { name: "Done" }).click();
    await expect(screen.getByRole("region", { name: "This Week" })).toBeVisible();
    await expect(page.getByText("Hallway screen")).toBeVisible();
    await context.close();
  });
});

test.describe("the wall screen", () => {
  test.beforeEach(() => {
    test.skip(!test.info().project.name.startsWith("display"), "the wall screen");
  });

  test("lays out its rail or bottom bar, the board and Today", async ({ page, request }) => {
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    const board = page.getByRole("region", { name: "This Week" });
    await expect(board).toBeVisible();
    await expect(board.locator("[aria-current=date]")).toHaveCount(1);
    await noSidewaysScroll(page, "the board");
    const size = page.viewportSize() ?? { width: 0, height: 0 };
    const rooms = await page.getByRole("navigation", { name: "Rooms" }).boundingBox();
    const today = page.getByRole("complementary", { name: "Today" });
    await expect(today).toBeVisible();
    const panel = await today.boundingBox();
    if (size.height > size.width) {
      // Portrait: the Today band on top, the bar at the bottom, full width.
      expect(rooms?.y && rooms.y + rooms.height).toBeCloseTo(size.height, 0);
      expect(rooms?.width).toBeCloseTo(size.width, 0);
      expect(panel?.y ?? Infinity).toBeLessThan((await board.boundingBox())?.y ?? 0);
    } else {
      // Landscape: the 192 px rail on the left, the 400 px Today panel on the right.
      expect(rooms?.x).toBe(0);
      expect(rooms?.width).toBeCloseTo(192, 0);
      expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeCloseTo(size.width, 0);
      await steadyDigits(page);
      await page.getByRole("button", { name: "Hide the Today panel" }).click();
      await expect(today).toBeHidden();
      await page.getByRole("button", { name: "Show the Today panel" }).click();
      await expect(today).toBeVisible();
    }
  });

  test("dims in the evening with a veil, unless the Pi's helper turns the screen down", async ({
    page,
    request,
  }) => {
    // 9 PM in New York: after "Dim in the evening" starts (8 PM), before sleep (10 PM).
    await request.post("/api/_test/clock", {
      headers: CSRF,
      data: { set: "2026-10-08T01:00:00Z" },
    });
    await seed(request);
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    const evening = await request.patch("/api/settings", {
      headers: CSRF,
      data: { sleep_from: "22:00", sleep_to: "06:30", dim_from: "20:00", dim_level: 40 },
    });
    expect(evening.ok()).toBe(true);
    await pairWall(page);
    // The launcher says who dims: the helper on a Pi that sets the brightness, else the page.
    await page.goto("/display?dimmer=screen");
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await expect(page.locator("[data-veil]")).toHaveCount(0);
    await page.goto("/display?dimmer=page");
    await expect(page.locator("[data-veil]")).toHaveClass(/opacity-45/);
  });

  test("pages through the weeks and comes back to this one", async ({ page, request }) => {
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    const board = page.getByRole("region", { name: "This Week" });
    const title = board.getByRole("heading", { level: 1 });
    const thisWeek = (await title.textContent()) ?? "";
    await expect(board.getByRole("button", { name: "This week" })).toBeDisabled();
    await board.getByRole("button", { name: "Next week" }).click();
    await expect(title).not.toHaveText(thisWeek);
    await expect(board.locator("[aria-current=date]")).toHaveCount(0);
    await board.getByRole("button", { name: "This week" }).click();
    await expect(title).toHaveText(thisWeek);
    await expect(board.locator("[aria-current=date]")).toHaveCount(1);
  });

  test("sleeps on schedule and wakes at a touch", async ({ page, request }) => {
    // 11:30 PM in the household's zone, inside a 10 PM to 6 AM sleep schedule. No PIN: the wall
    // screen may change settings itself.
    await request.post("/api/_test/clock", {
      headers: CSRF,
      data: { set: "2026-10-08T03:30:00Z" },
    });
    await seed(request);
    await pairWall(page);
    const changed = await page.request.patch("/api/settings", {
      headers: CSRF,
      data: { sleep_from: "22:00", sleep_to: "06:00", sleep_mode: "dim_clock" },
    });
    expect(changed.status()).toBe(200);
    await page.goto("/display");
    const night = page.getByRole("button", { name: "The screen is sleeping. Tap to wake it." });
    await expect(night).toBeVisible();
    await expect(night).toContainText("11:30");
    await night.click();
    await expect(night).toBeHidden();
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
  });
});

test.describe("a laptop", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop", "a laptop");
  });

  test("gets the display shell and types with its own keyboard", async ({ page, request }) => {
    await seed(request);
    await signInPhone(page);
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Rooms" })).toBeVisible();
    await noSidewaysScroll(page, "the board");
    // A parent's laptop: Settings opens without a PIN.
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Family", level: 2 })).toBeVisible();
    const field = page.getByLabel("Add a person");
    await field.click();
    await page.keyboard.type("Zoe");
    await expect(field).toHaveValue("Zoe");
    await expect(page.getByRole("group", { name: "On-screen keyboard" })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Change Zoe" })).toBeVisible();
  });
});
