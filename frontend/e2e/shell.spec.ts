/**
 * The two shells at every size (ADR 0014, UX §3): the wall screen's rail and Today panel in
 * landscape, the Today band and bottom bar in portrait, a laptop in the display shell with its
 * own keyboard, the wall's keyboard inside a sheet, phones with the tab bar. Nothing scrolls
 * sideways. The evening dim on the wall, and About's New versions on a phone. Synthetic data
 * only.
 */
import type { Page } from "@playwright/test";

import { expect, pairWall, PASSWORD, PIN, seed, signInPhone, test, wall } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };

async function noSidewaysScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(0);
}

/** The page's stream is open and has heard the server's hello (lib/live marks the root). */
async function hearsLive(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-stream", "live");
}

/** Every digit of the clock sits in a box of one width, so the time never jiggles (ADR 0021). */
async function steadyDigits(page: Page): Promise<void> {
  const widths = await page
    .getByRole("banner")
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
    // Connected, the Calendar's header has no live-updates icon: it shows only when something's
    // wrong (ADR 0030).
    await hearsLive(page);
    await expect(page.getByRole("img", { name: /^Live updates/ })).toHaveCount(0);
    await noSidewaysScroll(page, "Calendar");
    await page.getByRole("link", { name: "More" }).click();
    await expect(page.getByRole("heading", { name: "More", level: 1 })).toBeVisible();
    await noSidewaysScroll(page, "More");
    await page.getByRole("link", { name: "Settings" }).click();
    for (const title of [
      "Family",
      "Display",
      "Household",
      "Phones & Screens",
      "Recently Removed",
      "About",
    ]) {
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
    // Connection shows the live-updates icon, named in words; Storage says Free space.
    await expect(page.getByRole("img", { name: "Live updates: connected" })).toBeVisible();
    await expect(page.getByText("Free space", { exact: true })).toBeVisible();
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

  test("saves a setting the moment it changes, with no Save button, and the wall hears", async ({
    page,
    request,
    browser,
    watch,
  }) => {
    await seed(request);
    const { page: screen, context } = await wall(browser, watch);
    await pairWall(screen);
    await screen.goto("/display");
    await expect(screen.getByRole("region", { name: "This Week" })).toBeVisible();
    await signInPhone(page);
    await page.goto("/settings/features");
    await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
    // No Save button anywhere on the page (ADR 0029).
    await expect(page.getByRole("button", { name: /^Save/ })).toHaveCount(0);
    // A feature with a page of its own shows a row that opens it, not a second copy of its form.
    await expect(page.getByRole("link", { name: "Tasks settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Meals settings" })).toBeVisible();
    await expect(page.getByRole("switch", { name: /^Stars/ })).toHaveCount(0);

    // Lists keeps its one setting here: a tap on a choice saves it, and the wall asks again.
    const lists = () =>
      page.request
        .get("/api/plugins")
        .then(
          (response) =>
            response.json() as Promise<{ id: string; settings: { auto_clear_days?: string } }[]>,
        )
        .then(
          (plugins) => plugins.find((plugin) => plugin.id === "lists")?.settings.auto_clear_days,
        );
    const clear = page.getByRole("group", { name: "Clear completed items after" });
    const heard = screen.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/plugins" &&
        response.request().method() === "GET",
      { timeout: 3_000 },
    );
    await clear.getByRole("button", { name: "3 days" }).click();
    await expect(clear.getByRole("button", { name: "3 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await heard;
    await expect.poll(lists).toBe("3");
    // Put it back, the same way (the test server keeps plugin settings between tests).
    await clear.getByRole("button", { name: "Never" }).click();
    await expect.poll(lists).toBe("never");

    // Household: the name saves when the field is left, and says so quietly.
    await page.goto("/settings/household");
    const name = page.getByLabel("Name", { exact: true });
    await expect(name).toHaveValue("Sample Family");
    await name.fill("Sample Household");
    await name.blur();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const saved = (await (await page.request.get("/api/settings")).json()) as {
      household_name: string;
    };
    expect(saved.household_name).toBe("Sample Household");
    // An emptied name isn't saved: the old one comes back.
    await name.fill("");
    await name.blur();
    await expect(name).toHaveValue("Sample Household");
    await context.close();
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
    const header = await page.getByRole("banner").boundingBox();
    await steadyDigits(page);
    if (size.height > size.width) {
      // Portrait: the header across the top, the Today band under it, the bar at the bottom.
      expect(header).toMatchObject({ x: 0, y: 0, width: size.width });
      expect(rooms?.y && rooms.y + rooms.height).toBeCloseTo(size.height, 0);
      expect(rooms?.width).toBeCloseTo(size.width, 0);
      expect(panel?.y ?? 0).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
      expect(panel?.y ?? Infinity).toBeLessThan((await board.boundingBox())?.y ?? 0);
    } else {
      // Landscape: the 192 px rail on the left; beside it the header, over the board and the
      // 400 px Today panel on the right.
      expect(rooms?.x).toBe(0);
      expect(rooms?.width).toBeCloseTo(192, 0);
      expect(header?.x).toBeCloseTo(192, 0);
      expect(header?.y).toBe(0);
      expect(header?.width).toBeCloseTo(size.width - 192, 0);
      expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeCloseTo(size.width, 0);
      expect(panel?.y ?? 0).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
      // At Standard on 1920 px it's one row: today, the room's title and controls, the corner.
      if (size.width >= 1920) expect(header?.height ?? 0).toBeLessThanOrEqual(84);
      // The rail starts with the Sunroom mark alone, in a block as tall as the header, so the
      // rule under it meets the header's (ADR 0030). No word beside it.
      const rail = page.getByRole("navigation", { name: "Rooms" });
      const mark = rail.getByRole("img", { name: "Sunroom" });
      await expect(rail).not.toContainText("Sunroom");
      const block = await mark.locator("xpath=..").boundingBox();
      const drawn = await mark.boundingBox();
      if (size.width >= 1920) expect(block?.height).toBeCloseTo(header?.height ?? 0, 0);
      // Centred, like the rooms' icons under it (the rail's own rule takes a pixel).
      expect(Math.abs((drawn?.x ?? 0) + (drawn?.width ?? 0) / 2 - 192 / 2)).toBeLessThanOrEqual(1);
      // The header's two toggles sit at its ends, each nearest its own panel.
      const banner = page.getByRole("banner");
      const fold = await banner.getByRole("button", { name: "Hide the rail" }).boundingBox();
      const hide = await banner.getByRole("button", { name: "Hide the Today panel" }).boundingBox();
      const date = await banner.locator("p").first().boundingBox();
      expect(fold?.x ?? 0).toBeLessThan(date?.x ?? 0);
      expect(Math.round((fold?.x ?? 0) - (header?.x ?? 0))).toBe(24);
      expect(hide?.x ?? 0).toBeGreaterThan(size.width - 100);
      await page.getByRole("button", { name: "Hide the Today panel" }).click();
      await expect(today).toBeHidden();
      await page.getByRole("button", { name: "Show the Today panel" }).click();
      await expect(today).toBeVisible();
    }
  });

  test("shows nothing in its corner while it hears live updates, and says so when it can't", async ({
    page,
    request,
  }) => {
    await request.post("/api/_test/clock", {
      headers: CSRF,
      data: { set: "2026-10-07T14:00:00Z" },
    });
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    const board = page.getByRole("region", { name: "This Week" });
    const header = page.getByRole("banner");
    await expect(board).toBeVisible();
    await hearsLive(page);
    await expect(header.locator("[data-live]")).toHaveCount(0);
    // The server drops every stream: the screen reconnects by itself, too quickly to say so.
    const dropped = await page.request.post("/api/_test/drop-streams", { headers: CSRF });
    expect(dropped.status()).toBe(204);
    for (let sample = 0; sample < 15; sample++) {
      await expect(header.locator("[data-live]")).toHaveCount(0);
      await page.waitForTimeout(200);
    }
    await hearsLive(page);
    // Now the stream can't be opened at all: within seconds the corner says so.
    await page.route("**/api/events*", (route) => route.abort());
    await page.request.post("/api/_test/drop-streams", { headers: CSRF });
    const icon = header.getByRole("img", {
      name: /^Live updates: (reconnecting|checking every 30 seconds)$/,
    });
    await expect(icon).toBeVisible({ timeout: 15_000 });
    // The screen's top-right corner: the last thing on the header's first line.
    const corner = await icon.boundingBox();
    const box = await header.boundingBox();
    expect((corner?.x ?? 0) + (corner?.width ?? 0)).toBeGreaterThan(
      (box?.x ?? 0) + (box?.width ?? 0) - 80,
    );
    // The way is clear again. A stream that kept failing is retried once a minute; the wall also
    // opens a new one on every room switch, and the corner clears as soon as it's heard.
    await page.unroute("**/api/events*");
    await page.getByRole("link", { name: "Lists", exact: true }).click();
    await expect(header.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    await expect(header.locator("[data-live]")).toHaveCount(0, { timeout: 10_000 });
    await hearsLive(page);
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(board).toBeVisible();
    await hearsLive(page);
    // And it hears changes again.
    const added = await page.request.post("/api/calendar/events", {
      headers: CSRF,
      data: { title: "Library day", start_date: "2026-10-08" },
    });
    expect(added.status()).toBe(201);
    await expect(board.getByRole("button", { name: /^Library day/ })).toBeVisible({
      timeout: 3_000,
    });
  });

  test("hides the pointer three seconds after the mouse stops, and at once on a touch", async ({
    page,
    request,
  }) => {
    await seed(request);
    const root = page.locator("html");
    // Before it's paired, too: the pair code is on a wall like everything else.
    await page.goto("/display");
    await expect(page.getByTestId("pair-code")).toBeVisible();
    await page.mouse.move(600, 400);
    await expect(root).not.toHaveAttribute("data-pointer", "hidden");
    await expect(root).toHaveAttribute("data-pointer", "hidden", { timeout: 5_000 });
    await pairWall(page);
    await page.goto("/display");
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await page.mouse.move(620, 420);
    await expect(root).not.toHaveAttribute("data-pointer", "hidden");
    await expect(root).toHaveAttribute("data-pointer", "hidden", { timeout: 5_000 });
    const arrow = page.getByRole("button", { name: "Next week" });
    expect(await arrow.evaluate((node) => getComputedStyle(node).cursor)).toBe("none");
    // A move brings it back, as a video player does.
    await page.mouse.move(640, 440);
    await expect(root).not.toHaveAttribute("data-pointer", "hidden");
    expect(await arrow.evaluate((node) => getComputedStyle(node).cursor)).not.toBe("none");
    // A finger hides it at once, and it stays hidden in the room the tap opened (the wall
    // remounts its shell there).
    await page.getByRole("link", { name: "Lists", exact: true }).tap();
    expect(await root.getAttribute("data-pointer")).toBe("hidden");
    await expect(page.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    expect(await root.getAttribute("data-pointer")).toBe("hidden");
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
    // The arrows live in the wall's header. It draws no title and no dates (ADR 0030: the day
    // heads carry them); the room's name is still the page's heading for a screen reader.
    const header = page.getByRole("banner");
    const title = header.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("This Week");
    await expect(title).toHaveClass(/sr-only/);
    await expect(header).not.toContainText("2026");
    const firstDay = board.getByRole("heading", { level: 2 }).first();
    const thisWeek = (await firstDay.textContent()) ?? "";
    await expect(header.getByRole("button", { name: "This week" })).toBeDisabled();
    await header.getByRole("button", { name: "Next week" }).click();
    await expect(title).not.toHaveText("This Week");
    await expect(firstDay).not.toHaveText(thisWeek);
    await expect(board.locator("[aria-current=date]")).toHaveCount(0);
    await header.getByRole("button", { name: "This week" }).click();
    await expect(title).toHaveText("This Week");
    await expect(firstDay).toHaveText(thisWeek);
    await expect(board.locator("[aria-current=date]")).toHaveCount(1);
  });

  test("toggles the Today panel from any room, Settings included", async ({ page, request }) => {
    test.skip(test.info().project.name !== "display-1080p", "landscape: portrait has the band");
    await seed(request);
    await pairWall(page);
    // No PIN in this household: the wall opens Settings itself.
    await page.goto("/settings/display");
    await expect(page.getByRole("heading", { name: "Display", level: 2 })).toBeVisible();
    const header = page.getByRole("banner");
    await expect(header.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    const today = page.getByRole("complementary", { name: "Today" });
    await expect(today).toBeVisible();
    await header.getByRole("button", { name: "Hide the Today panel" }).click();
    await expect(today).toBeHidden();
    // It stays hidden from room to room, until someone shows it.
    await page.getByRole("link", { name: "Lists" }).click();
    await expect(header.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    await expect(header.getByRole("button", { name: "New list" })).toBeVisible();
    await expect(today).toBeHidden();
    await header.getByRole("button", { name: "Show the Today panel" }).click();
    await expect(today).toBeVisible();
  });

  test("folds its rail to icons, and keeps it folded through two idle minutes", async ({
    page,
    request,
  }) => {
    test.skip(test.info().project.name !== "display-1080p", "landscape: portrait's bar is whole");
    await seed(request);
    await pairWall(page);
    // The idle timers run on the page's clock, so two minutes take no time.
    await page.clock.install();
    await page.goto("/display");
    const board = page.getByRole("region", { name: "This Week" });
    await expect(board).toBeVisible();
    const rail = page.getByRole("navigation", { name: "Rooms" });
    const width = async () => Math.round((await rail.boundingBox())?.width ?? 0);
    const boardWidth = async () => Math.round((await board.boundingBox())?.width ?? 0);
    expect(await width()).toBe(192);
    const wide = await boardWidth();
    // Hide the rail lives in the header, before today, across from the Today panel's button.
    const header = page.getByRole("banner");
    await expect(rail.getByRole("button", { name: /the rail$/ })).toHaveCount(0);
    const add = rail.getByRole("button", { name: "Add", exact: true });
    const settings = rail.getByRole("button", { name: "Settings" });
    const box = async (target: typeof add) => {
      const found = await target.boundingBox();
      return { width: Math.round(found?.width ?? 0), height: Math.round(found?.height ?? 0) };
    };
    // Whole: Settings is one row, as tall as a tap target (and as the tips strip beside it).
    expect((await box(settings)).height).toBe(56);
    expect((await box(settings)).width).toBe(191);
    await expect(settings).toContainText("Settings");

    await header.getByRole("button", { name: "Hide the rail" }).click();
    await expect(header.getByRole("button", { name: "Show the rail" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect.poll(width).toBe(72);
    // Never fully hidden: every room, Add and Settings are still one tap away, by name. The
    // words fade rather than leave, so each room keeps its name.
    for (const name of ["Calendar", "Lists", "Tasks", "Meals", "Countdowns", "Photos"]) {
      await expect(rail.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(add).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(rail.getByRole("img", { name: "Sunroom" })).toBeVisible();
    // Folded, Add is the size of a room's icon, not a 64 px circle in a 72 px rail.
    await expect.poll(async () => (await box(add)).width).toBe(56);
    expect((await box(add)).height).toBe(56);
    expect((await box(settings)).height).toBe(56);
    // The words under the icons take no room once the fold has finished.
    await expect
      .poll(() =>
        rail
          .getByRole("link", { name: "Lists", exact: true })
          .locator("span")
          .evaluate((word) => Math.round(word.getBoundingClientRect().height)),
      )
      .toBe(0);
    // The board takes the room, and the header starts where the rail ends.
    expect(await boardWidth()).toBe(wide + 120);
    expect(Math.round((await page.getByRole("banner").boundingBox())?.x ?? 0)).toBe(72);
    // It stays folded from room to room.
    await rail.getByRole("link", { name: "Lists", exact: true }).click();
    await expect(page.getByRole("banner").getByRole("heading", { name: "Lists" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "New list" })).toBeVisible();
    expect(await width()).toBe(72);
    await rail.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(board).toBeVisible();

    await header.getByRole("button", { name: "Show the rail" }).click();
    await expect.poll(width).toBe(192);
    await header.getByRole("button", { name: "Hide the rail" }).click();
    await expect.poll(width).toBe(72);
    // Left alone for two minutes, the board comes back to now and keeps what this screen chose
    // for itself: its view, the rail and the Today panel (ADR 0031).
    await header.getByRole("button", { name: "Hide the Today panel" }).click();
    const today = page.getByRole("complementary", { name: "Today" });
    await expect(today).toBeHidden();
    await header.getByRole("button", { name: "Month", exact: true }).click();
    await header.getByRole("button", { name: "Next month" }).click();
    const thisMonth = header.getByRole("button", { name: "This month" });
    await expect(thisMonth).toBeEnabled();
    await page.clock.fastForward(121_000);
    await expect(thisMonth).toBeDisabled();
    await expect(
      header.getByRole("button", { name: "Month", exact: true, pressed: true }),
    ).toBeVisible();
    expect(await width()).toBe(72);
    await expect(today).toBeHidden();
  });

  test("keeps its rail folded when the household picks Compact rail", async ({ page, request }) => {
    test.skip(test.info().project.name !== "display-1080p", "landscape: portrait's bar is whole");
    await seed(request);
    await pairWall(page);
    await page.clock.install();
    // No PIN in this household: the wall opens Settings itself.
    await page.goto("/settings/display");
    const rail = page.getByRole("navigation", { name: "Rooms" });
    const width = async () => Math.round((await rail.boundingBox())?.width ?? 0);
    expect(await width()).toBe(192);
    const compact = page.getByRole("switch", { name: /^Compact rail/ });
    await compact.click();
    await expect(compact).toBeChecked();
    await expect.poll(width).toBe(72);
    // The setting lasts: two idle minutes send the wall home, still folded.
    await page.clock.fastForward(121_000);
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    expect(await width()).toBe(72);
    // Anyone can open it back out, and it stays out while the screen sits idle.
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: "Show the rail" }).click();
    await expect.poll(width).toBe(192);
    await header.getByRole("button", { name: "Next week" }).click();
    const thisWeek = header.getByRole("button", { name: "This week" });
    await expect(thisWeek).toBeEnabled();
    await page.clock.fastForward(121_000);
    await expect(thisWeek).toBeDisabled();
    expect(await width()).toBe(192);
    // Until the household chooses again: the latest choice wins (ADR 0031).
    await page.goto("/settings/display");
    await expect(compact).toBeChecked();
    await compact.click();
    await expect(compact).not.toBeChecked();
    expect(await width()).toBe(192);
    await compact.click();
    await expect(compact).toBeChecked();
    await expect.poll(width).toBe(72);
  });

  test("comes back where it was after a refresh, unless the household says the home view", async ({
    page,
    request,
  }) => {
    test.skip(test.info().project.name !== "display-1080p", "landscape: the rail and the panel");
    await request.post("/api/_test/clock", {
      headers: CSRF,
      data: { set: "2026-10-07T14:00:00Z" },
    });
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    const header = page.getByRole("banner");
    const rail = page.getByRole("navigation", { name: "Rooms" });
    const today = page.getByRole("complementary", { name: "Today" });
    const shell = page.locator("[data-shell]");
    const pressed = (name: string) =>
      page.getByRole("button", { name, exact: true, pressed: true });
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    // Hours on the Week, zoomed in; then next month, two people, the rail folded, no Today panel.
    await page.getByRole("button", { name: "Hours", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await header.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: "Mia" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Leo" }).click();
    await page.keyboard.press("Escape");
    await header.getByRole("button", { name: "Month", exact: true }).click();
    await header.getByRole("button", { name: "Next month" }).click();
    await header.getByRole("button", { name: "Hide the rail" }).click();
    await header.getByRole("button", { name: "Hide the Today panel" }).click();
    await expect(today).toBeHidden();

    await page.reload();
    await expect(pressed("Month")).toBeVisible();
    await expect(header.getByRole("button", { name: "This month" })).toBeEnabled();
    await expect(shell).toHaveAttribute("data-rail", "compact");
    await expect(today).toBeHidden();
    await expect(header.getByRole("button", { name: "Filter: Mia, Leo" })).toBeVisible();
    // The Week's layout and its zoom came back with it.
    await header.getByRole("button", { name: "Week", exact: true }).click();
    await expect(pressed("Hours")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeEnabled();

    // A restart: the Pi's launcher always opens /display, and the screen goes back to its room.
    await rail.getByRole("link", { name: "Lists", exact: true }).click();
    await expect(header.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    const kept = (key: string) => page.evaluate((name) => localStorage.getItem(name), key);
    await expect.poll(() => kept("sunroom.display.room")).toBe("/lists");
    await page.goto("/display");
    await page.waitForURL((url) => url.pathname === "/lists");
    await expect(header.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    await expect(shell).toHaveAttribute("data-rail", "compact");

    // Settings → Display → When it starts → The home view: the screen keeps nothing from then
    // on, and the next start is the home view at home.
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    try {
      const home = await request.patch("/api/settings", {
        headers: CSRF,
        data: { display_start: "home" },
      });
      expect(home.ok()).toBe(true);
      await expect.poll(() => kept("sunroom.display.view")).toBeNull();
      await page.reload();
      await page.waitForURL((url) => url.pathname === "/display");
      await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
      await expect(header.getByRole("button", { name: "This week" })).toBeDisabled();
      await expect(shell).toHaveAttribute("data-rail", "full");
      await expect(today).toBeVisible();
      await expect(pressed("Agenda")).toBeVisible();
      await expect(header.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
    } finally {
      await request.patch("/api/settings", { headers: CSRF, data: { display_start: "last" } });
    }
  });

  test("shows a padlock only while Settings are locked behind the PIN", async ({
    page,
    request,
  }) => {
    await seed(request, { pin: PIN });
    await pairWall(page);
    await page.goto("/display");
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    const settings = page.getByRole("button", { name: "Settings" });
    await expect(settings).toHaveAttribute("data-icon", "lock");
    await settings.click();
    const pin = page.getByRole("dialog", { name: "Parent PIN" });
    for (const digit of PIN) await pin.getByRole("button", { name: digit, exact: true }).click();
    await expect(pin).toBeHidden();
    // Open for now: a gear, and the header's own Lock button ends it.
    await expect(settings).toHaveAttribute("data-icon", "gear");
    await page.getByRole("banner").getByRole("button", { name: "Lock" }).click();
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await expect(settings).toHaveAttribute("data-icon", "lock");
  });

  test("types into a sheet with its own keyboard, and the sheet rises above the keys", async ({
    page,
    request,
  }) => {
    await seed(request);
    await pairWall(page);
    await page.goto("/settings/family");
    await page.getByRole("button", { name: "Edit Mia" }).click();
    const sheet = page.getByRole("dialog", { name: "Edit Mia" });
    const field = sheet.getByLabel("Name");
    await field.click();
    await field.evaluate((node: HTMLInputElement) => {
      node.setSelectionRange(node.value.length, node.value.length);
    });
    const keyboard = page.getByRole("group", { name: "On-screen keyboard" });
    // After a space mid-name the keys are small letters; Shift makes one capital.
    await keyboard.getByRole("button", { name: "Space" }).click();
    for (const key of ["Shift", "R", "o", "s", "e"]) {
      await keyboard.getByRole("button", { name: key, exact: true }).click();
    }
    await expect(field).toHaveValue("Mia Rose");
    const keys = await keyboard.boundingBox();
    const box = await sheet.boundingBox();
    expect(keys && box && box.y + box.height <= keys.y).toBe(true);
    await keyboard.getByRole("button", { name: "Done" }).click();
    await expect(keyboard).toHaveCount(0);
    await sheet.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Edit Mia Rose" })).toBeVisible();
  });

  test("shows a tip under the board once the household turns tips on", async ({
    page,
    request,
  }) => {
    await request.post("/api/_test/clock", {
      headers: CSRF,
      data: { set: "2026-10-07T14:00:00Z" },
    });
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    const board = page.getByRole("region", { name: "This Week" });
    await expect(board).toBeVisible();
    const strip = page.locator("[data-tips]");
    // Off until someone turns it on.
    await expect(strip).toHaveCount(0);
    const on = await page.request.patch("/api/settings", {
      headers: CSRF,
      data: { show_tips: true },
    });
    expect(on.ok()).toBe(true);
    await expect(strip).toBeVisible();
    const tip = strip.locator("p");
    const first = (await tip.textContent()) ?? "";
    await strip.getByRole("button", { name: "Next tip" }).click();
    await expect(tip).not.toHaveText(first);
    // A 56 px strip under the board; the board gives it the room.
    const box = await strip.boundingBox();
    const above = await board.boundingBox();
    expect(Math.round(box?.height ?? 0)).toBe(56);
    expect((above?.y ?? 0) + (above?.height ?? 0)).toBeLessThanOrEqual((box?.y ?? 0) + 1);
    // Hours still fits the whole day with nothing to scroll.
    await page.getByRole("button", { name: "Hours", exact: true }).click();
    const grid = board.locator("[data-hours]");
    await expect(grid).toBeVisible();
    expect(
      await grid.evaluate((node) => node.scrollHeight - node.clientHeight),
    ).toBeLessThanOrEqual(0);
  });

  test("takes the Small text size from another device at once, and keeps its tap targets", async ({
    page,
    request,
  }) => {
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    const rootPx = () =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(await rootPx()).toBe(16);
    // A parent's phone (its own cookies) picks Small in Settings → Display.
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    const small = await request.patch("/api/settings", {
      headers: CSRF,
      data: { text_size: "small" },
    });
    expect(small.ok()).toBe(true);
    await expect.poll(rootPx, { timeout: 3_000 }).toBe(14);
    // Text and spacing shrink; a target never does (UX §1).
    const arrow = await page.getByRole("button", { name: "Next week" }).boundingBox();
    expect(Math.round(arrow?.height ?? 0)).toBeGreaterThanOrEqual(56);
    expect(Math.round(arrow?.width ?? 0)).toBeGreaterThanOrEqual(56);
  });

  test("takes a feature's setting from a phone at once: the screensaver's timing", async ({
    page,
    request,
  }) => {
    test.skip(test.info().project.name !== "display-1080p", "one wall is enough");
    await seed(request);
    await pairWall(page);
    await page.goto("/display");
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await hearsLive(page);
    // A parent's phone (its own cookies) changes Start after in Photos & Screensaver.
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    const startAfter = (minutes: string) =>
      request.put("/api/plugins/screensaver/settings", {
        headers: CSRF,
        data: { values: { start_after: minutes } },
      });
    try {
      // The wall asks for the screensaver's settings again by itself: no refresh (ADR 0029).
      const asked = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/screensaver/manifest" &&
          response.request().method() === "GET",
        { timeout: 3_000 },
      );
      expect((await startAfter("30")).ok()).toBe(true);
      const manifest = (await (await asked).json()) as {
        settings: { start_after_minutes: number };
      };
      expect(manifest.settings.start_after_minutes).toBe(30);
    } finally {
      // The test server keeps plugin settings between tests.
      await startAfter("15");
    }
  });

  test("keeps its other rooms while a feature is switched off and on", async ({
    page,
    request,
  }) => {
    test.skip(test.info().project.name !== "display-1080p", "the rail, in landscape");
    await seed(request);
    await pairWall(page);
    await page.goto("/lists");
    const rail = page.getByRole("navigation", { name: "Rooms" });
    await expect(rail.getByRole("link", { name: "Meals" })).toBeVisible();
    await hearsLive(page);
    // Watch every change to the page: the Lists room must never leave the rail, not for a frame.
    await page.evaluate(() => {
      const seen = window as unknown as { railLostLists?: boolean };
      seen.railLostLists = false;
      new MutationObserver(() => {
        if (!document.querySelector('nav[aria-label="Rooms"] a[href="/lists"]')) {
          seen.railLostLists = true;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    try {
      const off = await request.post("/api/plugins/meals/disable", { headers: CSRF });
      expect(off.ok()).toBe(true);
      await expect(rail.getByRole("link", { name: "Meals" })).toHaveCount(0, { timeout: 3_000 });
      const on = await request.post("/api/plugins/meals/enable", { headers: CSRF });
      expect(on.ok()).toBe(true);
      await expect(rail.getByRole("link", { name: "Meals" })).toBeVisible({ timeout: 3_000 });
    } finally {
      await request.post("/api/plugins/meals/enable", { headers: CSRF });
    }
    await expect(rail.getByRole("link", { name: "Lists" })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { railLostLists?: boolean }).railLostLists),
    ).toBe(false);
  });

  test("catches up on a setting changed while its stream was down", async ({ page, request }) => {
    test.skip(test.info().project.name !== "display-1080p", "one wall is enough");
    await seed(request);
    await pairWall(page);
    await page.goto("/lists");
    await expect(page.getByRole("heading", { name: "Lists", level: 1 })).toBeVisible();
    await hearsLive(page);
    const rootPx = () =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(await rootPx()).toBe(16);
    const parent = await request.post("/api/auth/login", {
      headers: CSRF,
      data: { password: PASSWORD },
    });
    expect(parent.ok()).toBe(true);
    // Every stream drops, and the setting changes before the wall has reconnected: the server
    // replays what the wall missed from where it last heard.
    const dropped = await request.post("/api/_test/drop-streams", { headers: CSRF });
    expect(dropped.status()).toBe(204);
    const small = await request.patch("/api/settings", {
      headers: CSRF,
      data: { text_size: "small" },
    });
    expect(small.ok()).toBe(true);
    await expect.poll(rootPx, { timeout: 3_000 }).toBe(14);
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
    // A parent's laptop: Settings is a gear, and opens without a PIN.
    await expect(page.getByRole("button", { name: "Settings" })).toHaveAttribute(
      "data-icon",
      "gear",
    );
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Family", level: 2 })).toBeVisible();
    const field = page.getByLabel("Add a person");
    await field.click();
    await page.keyboard.type("Zoe");
    await expect(field).toHaveValue("Zoe");
    await expect(page.getByRole("group", { name: "On-screen keyboard" })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Edit Zoe" })).toBeVisible();
  });

  test("keeps its pointer: there's a person behind the mouse", async ({ page, request }) => {
    await seed(request);
    await signInPhone(page);
    await expect(page.getByRole("region", { name: "This Week" })).toBeVisible();
    await page.mouse.move(600, 400);
    await page.waitForTimeout(3_500);
    await expect(page.locator("html")).not.toHaveAttribute("data-pointer", "hidden");
  });
});

test.describe("after the container is updated", () => {
  test.beforeEach(() => {
    const name = test.info().project.name;
    test.skip(name !== "display-1080p" && name !== "phone-webkit", "the wall and an iPhone");
  });

  test("every open screen says so and refreshes itself, once", async ({ page, request }) => {
    await seed(request);
    if (test.info().project.name === "display-1080p") {
      await pairWall(page);
      await page.goto("/display");
    } else {
      await signInPhone(page);
      await page.goto("/calendar");
    }
    await hearsLive(page);
    // Every hello from now on names another version, as after `docker compose pull && up -d`.
    // Not just the next one: a hello naming the page's own version after the new one rightly
    // calls the refresh off, so a page that opened one more stream in between never reloaded.
    const updated = await request.post("/api/_test/version", {
      headers: CSRF,
      data: { version: "9.9.9" },
    });
    expect(updated.status()).toBe(204);
    const reloaded = page.waitForEvent("load");
    const dropped = await request.post("/api/_test/drop-streams", { headers: CSRF });
    expect(dropped.status()).toBe(204);
    // Only this toast: at the right hour the seed's own events remind, 30 minutes ahead.
    const said = page.locator("[data-toast]").filter({ hasText: "Sunroom was updated to 9.9.9" });
    await expect(said).toBeVisible();
    await reloaded;
    // The reloaded page hears that version again: it has refreshed for it once, and says no more.
    await hearsLive(page);
    await page.waitForTimeout(1500);
    await expect(said).toHaveCount(0);
  });
});
