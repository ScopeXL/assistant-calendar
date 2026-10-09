/**
 * The Week board's Hours layout end to end (UX §4 "Week board, Hours layout", ADR 0028): the
 * whole day at 24h with nothing to scroll, the zoom ladder, a drop that keeps the time, a tap
 * that adds at a time, and the layout and zoom going back after two minutes idle. The server's
 * clock reads Wednesday, October 7, 2026, 10:00 AM in New York. Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, seed, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("display"), "the wall screen");
  const moved = await request.post("/api/_test/clock", {
    headers: CSRF,
    data: { set: WEDNESDAY_10AM },
  });
  expect(moved.status()).toBe(204);
  await seed(request);
});

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not on the page");
  return box;
}

/** A long press (the board's drag sensor waits 400 ms), then a slow move and a drop. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await boxOf(from);
  const end = await boxOf(to);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
  // dnd-kit swallows clicks for 50 ms after a drop; a person never taps that fast.
  await page.waitForTimeout(100);
}

test("the Hours layout fits the day, zooms, keeps the time on a drop and adds at a tapped time", async ({
  page,
}) => {
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  await expect(board).toBeVisible();
  await page.getByRole("button", { name: "Hours", exact: true }).click();
  const grid = board.locator("[data-hours]");
  await expect(grid).toBeVisible();
  await expect(page.getByRole("button", { name: "24h", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // 24h: the whole day fits, and nothing scrolls.
  const wednesday = board.locator('[data-day="2026-10-07"] [data-day-body]');
  await expect(wednesday.locator("[data-now-line]")).toBeVisible();
  expect(await grid.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(
    0,
  );
  const day = await boxOf(wednesday);
  const fit = day.height;
  // A one-hour event: a 56 px button holding a block as tall as its hour.
  const soccer = board.getByRole("button", {
    name: /^Soccer practice, 4:00 to 5:00 PM, .*Thursday/,
  });
  const block = soccer.locator(":scope > span");
  expect(Math.round((await boxOf(soccer)).height)).toBe(56);
  expect(Math.abs((await boxOf(block)).height - fit / 24)).toBeLessThanOrEqual(1.5);
  // The now line at 10:00, ten 24ths of the way down today.
  const nowLine = wednesday.locator("[data-now-line]");
  expect(Math.abs((await boxOf(nowLine)).y - day.y - (10 / 24) * fit)).toBeLessThanOrEqual(2);
  await expect(nowLine.locator(".now-label")).toHaveText(/^now 10:0\d$/);

  // 12h: twice as tall, scrolled so now sits a third of the way down; the hour twice as tall.
  await page.getByRole("button", { name: "12h", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await boxOf(wednesday)).height - 2 * fit))
    .toBeLessThanOrEqual(1);
  expect(Math.abs((await grid.evaluate((node) => node.scrollTop)) - fit / 2)).toBeLessThanOrEqual(
    2,
  );
  expect(Math.abs((await boxOf(block)).height - fit / 12)).toBeLessThanOrEqual(1.5);

  // 1h: at least a full two-line chip for a half hour.
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await boxOf(block)).height - Math.max(144, fit / 6)))
    .toBeLessThanOrEqual(1.5);

  // A drop on another day keeps the time of day.
  const vet = board.getByRole("button", { name: /^Vet, 9:00 to 9:30 AM, Ana, Wednesday/ });
  await vet.scrollIntoViewIfNeeded();
  await drag(page, vet, board.locator('[data-day="2026-10-09"] h2'));
  await expect(toast(page, "Moved Vet to Fri")).toBeVisible();
  await expect(toast(page, "Moved Vet to Fri").getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(
    board.getByRole("button", { name: /^Vet, 9:00 to 9:30 AM, Ana, Friday October 9/ }),
  ).toBeAttached();

  // A tap on an empty spot adds an event at that time, on that day.
  const friday = await boxOf(board.locator('[data-day="2026-10-09"] [data-day-body]'));
  const pph = friday.height / 24;
  await page.mouse.click(friday.x + friday.width / 2, friday.y + 10.5 * pph + 2);
  const add = page.getByRole("dialog", { name: "Add" });
  await expect(add.getByRole("button", { name: "10:30 AM" })).toBeVisible();
  await expect(add.getByRole("button", { name: "Fri, Oct 9" })).toBeVisible();
});

test("the zoom and the layout go back after two minutes idle", async ({ page }) => {
  await page.clock.install();
  await pairWall(page);
  await page.goto("/display");
  const board = page.getByRole("region", { name: "This Week" });
  const grid = board.locator("[data-hours]");
  await page.getByRole("button", { name: "Hours", exact: true }).click();
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await expect(grid).toBeVisible();
  await page.clock.fastForward("02:05");
  await expect(grid).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agenda", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The household's choice: Hours with no tap, at 24h.
  const hours = await page.request.patch("/api/settings", {
    headers: CSRF,
    data: { display_week_layout: "hours" },
  });
  expect(hours.ok()).toBe(true);
  await page.reload();
  await expect(grid).toBeVisible();
  const whole = page.getByRole("button", { name: "24h", exact: true });
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "15m", exact: true }).click();
  await expect(whole).toHaveAttribute("aria-pressed", "false");
  await page.clock.fastForward("02:05");
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  await expect(grid).toBeVisible();
});
