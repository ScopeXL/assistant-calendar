/**
 * Chores end to end (PLAN §15 M3, UX §6): the done moment on the wall and its Undo, the moment
 * with Reduce Motion, "Who did it?", a routine run to its finish, and a reward asked for on the
 * wall, seen on a parent's phone and said yes to on the wall behind the PIN. The server's clock
 * reads Wednesday, October 7, 2026 in New York; the Sample Family's chores come from the seed.
 * Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, PASSWORD, phone, PIN, seed, signInPhone, test } from "./fixtures";

const CSRF = { "X-Sunroom": "1" };
const WEDNESDAY_10AM = "2026-10-07T14:00:00Z";
const WEDNESDAY_745PM = "2026-10-07T23:45:00Z";

function toast(page: Page, message: string): Locator {
  return page.locator("[data-toast]").filter({ hasText: message });
}

async function choresRoom(page: Page): Promise<void> {
  await pairWall(page);
  await page.goto("/chores");
  await expect(page.getByRole("heading", { name: "Chores · Today", level: 1 })).toBeVisible();
}

/** Whether the celebration canvas has anything painted on it right now. */
async function bursting(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[aria-hidden]");
    const context = canvas?.getContext("2d");
    if (!canvas || !context || canvas.width === 0) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let alpha = 3; alpha < data.length; alpha += 4 * 16)
      if ((data[alpha] ?? 0) > 0) return true;
    return false;
  });
}

test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "the wall screen at 1080p");
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_10AM } });
});

test("a chore done on the wall stamps, bursts and pops the count; Undo takes it all back", async ({
  page,
  request,
}) => {
  await seed(request);
  await choresRoom(page);
  const mia = page.getByRole("region", { name: "Mia", exact: true });
  await expect(mia).toContainText("1 of 2");
  await expect(mia).toContainText("42");
  const box = mia.getByRole("checkbox", { name: /^Feed the dog/ });
  await expect(box).toHaveAccessibleName("Feed the dog, Mia, 2 stars, due 5:00 PM");
  await expect(box).toHaveAttribute("aria-checked", "false");
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "true");
  await expect(box).toHaveAccessibleName(/^Feed the dog, Mia, 2 stars, Done by Mia/);
  await expect.poll(() => bursting(page)).toBe(true);
  await expect(page.locator("li.stamp")).toHaveCount(1);
  await expect(mia).toContainText("2 of 2");
  await expect(mia.locator(".pop").first()).toBeAttached();
  await expect(mia).toContainText("All done, Mia!");
  await expect(mia).toContainText("44");

  // Undo puts the box back, the count and the stars too.
  await toast(page, "Done by Mia").getByRole("button", { name: "Undo" }).click();
  await expect(mia.getByRole("checkbox", { name: /^Feed the dog/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(mia).toContainText("1 of 2");
  await expect(mia).toContainText("42");
  await expect(mia).not.toContainText("All done, Mia!");
});

test("with Reduce Motion the moment still reads as done, without a burst", async ({
  page,
  request,
}) => {
  await seed(request);
  const parent = await request.post("/api/auth/login", {
    headers: CSRF,
    data: { password: PASSWORD },
  });
  expect(parent.ok()).toBe(true);
  const calm = await request.patch("/api/settings", {
    headers: CSRF,
    data: { display_reduce_motion: true },
  });
  expect(calm.ok()).toBe(true);
  await choresRoom(page);
  const mia = page.getByRole("region", { name: "Mia", exact: true });
  const box = mia.getByRole("checkbox", { name: /^Feed the dog/ });
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "true");
  await expect(mia).toContainText("Done by Mia");
  await expect(mia).toContainText("2 of 2");
  await page.waitForTimeout(300);
  expect(await bursting(page)).toBe(false);
});

test("an Anyone chore asks who did it, and credits them", async ({ page, request }) => {
  await seed(request);
  await choresRoom(page);
  const anyone = page.getByRole("region", { name: "Anyone", exact: true });
  await anyone.getByRole("checkbox", { name: /^Water the plants, anyone/ }).click();
  const who = anyone.getByRole("group", { name: "Who did it?" });
  await who.getByRole("button", { name: "Leo" }).click();
  await expect(anyone).toContainText("Done by Leo");
  await expect(anyone).toContainText("1 of 2");
});

test("Leo runs his bedtime routine to its finish", async ({ page, request }) => {
  await request.post("/api/_test/clock", { headers: CSRF, data: { set: WEDNESDAY_745PM } });
  await seed(request);
  await choresRoom(page);
  const leo = page.getByRole("region", { name: "Leo", exact: true });
  await expect(leo).toContainText("Leo's bedtime routine");
  await leo.getByRole("button", { name: "Start" }).click();
  const runner = page.getByRole("dialog", { name: "Leo's bedtime routine" });
  await expect(runner).toContainText("Step 1 of 5");
  await expect(runner).toContainText("Pajamas on");
  for (const step of ["Pajamas on", "Brush teeth", "Read a book", "Glass of water", "Into bed"]) {
    await expect(runner.getByRole("heading", { name: step })).toBeVisible();
    await runner.getByRole("button", { name: "Done", exact: true }).click();
  }
  await expect(runner).toContainText("All done, Leo! Night night.");
  await expect(runner).toContainText("+5 stars");
  await runner.getByRole("button", { name: "Back to Chores" }).click();
  await expect(page.getByRole("heading", { name: "Chores · Today", level: 1 })).toBeVisible();
});

test("a reward asked for on the wall shows on a parent's phone; Approve on the wall asks for the PIN", async ({
  page,
  request,
  browser,
  watch,
}) => {
  await seed(request, { pin: PIN });
  await choresRoom(page);
  await page.getByRole("link", { name: "Stars & rewards" }).click();
  await expect(page.getByRole("heading", { name: "Stars & rewards", level: 1 })).toBeVisible();
  const tile = page.getByRole("listitem").filter({ hasText: "Ice cream run" });
  await tile.getByRole("button", { name: "Ask for it" }).click();
  const ask = page.getByRole("dialog", { name: "Ask for Ice cream run" });
  await ask.getByRole("button", { name: "Mia" }).click();
  await ask.getByRole("button", { name: "Ask for it" }).click();
  await expect(toast(page, "Asked for Ice cream run")).toBeVisible();

  // A parent's phone sees it on Today, with Approve and Not now.
  const { context, page: ana } = await phone(browser, watch);
  await signInPhone(ana, "Ana");
  const asked = ana.getByRole("region", { name: "Asked" });
  await expect(asked).toContainText("Mia · Ice cream run");
  await expect(asked.getByRole("button", { name: "Approve" })).toBeVisible();
  await context.close();

  // On the wall, Approve asks for the PIN first.
  const wallAsked = page.getByRole("region", { name: "Asked" });
  await expect(wallAsked).toContainText("Mia · Ice cream run");
  await wallAsked.getByRole("button", { name: "Approve" }).click();
  const pin = page.getByRole("dialog", { name: "Parent PIN" });
  await expect(pin).toBeVisible();
  for (const digit of PIN) await pin.getByRole("button", { name: digit, exact: true }).click();
  await expect(toast(page, "Mia got Ice cream run")).toBeVisible();
  await expect(page.getByRole("region", { name: "Asked" })).toHaveCount(0);
});
