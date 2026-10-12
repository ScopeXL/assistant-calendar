/**
 * Chores end to end (PLAN §15 M3, UX §6): the done moment on the wall, its "+2" flying to the
 * avatar, and its Undo; the moment with Reduce Motion; "Who did it?"; a routine run to its
 * finish; and a reward asked for on the wall, seen on a parent's phone and said yes to on the
 * wall behind the PIN. The server's clock reads Wednesday, October 7, 2026 in New York; the
 * Sample Family's chores come from the seed. Synthetic data only.
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
  await expect(page.getByRole("heading", { name: "Tasks Today", level: 1 })).toBeVisible();
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
  // "+2" flies to Mia's avatar in the Today panel, which bumps as it lands.
  const today = page.getByRole("complementary", { name: "Today" });
  await expect(today.locator("[data-points-to].bump")).toHaveCount(1);
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
  await runner.getByRole("button", { name: "Back to Tasks" }).click();
  await expect(page.getByRole("heading", { name: "Tasks Today", level: 1 })).toBeVisible();
});

test("a reward asked for on the wall shows on a parent's phone; Approve on the wall asks for the PIN", async ({
  page,
  request,
  browser,
  watch,
}) => {
  await seed(request, { pin: PIN });
  await choresRoom(page);
  await page.getByRole("link", { name: "Stars & Rewards" }).click();
  await expect(page.getByRole("heading", { name: "Stars & Rewards", level: 1 })).toBeVisible();
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

test("a task every two weeks on two days, with all five people on one line of Who", async ({
  page,
  request,
}) => {
  await seed(request);
  // A fifth person, added by a parent's phone: the owner's household has five.
  const parent = await request.post("/api/auth/login", {
    headers: CSRF,
    data: { password: PASSWORD },
  });
  expect(parent.ok()).toBe(true);
  const zoe = await request.post("/api/members", {
    headers: CSRF,
    data: { name: "Zoe", role: "kid" },
  });
  expect(zoe.status()).toBe(201);
  await choresRoom(page);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add" });
  // The Tasks room opens Add on Task, in the one row of kinds.
  await expect(
    add.getByRole("group", { name: "What to add" }).getByRole("button", { name: "Task" }),
  ).toHaveAttribute("aria-pressed", "true");
  await add.getByLabel("What", { exact: true }).fill("Water the garden");

  // Who: Anyone and five people, one line, 64 px avatars.
  const who = add.getByRole("group", { name: "Who", exact: true });
  const cells = who.getByRole("button");
  await expect(cells).toHaveCount(6);
  await expect(cells.first()).toHaveAccessibleName("Anyone");
  const boxes = await cells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const avatar = node.querySelector("span")?.getBoundingClientRect();
      return { y: Math.round(box.y), avatar: Math.round(avatar?.width ?? 0) };
    }),
  );
  expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
  expect(boxes.map((box) => box.avatar)).toEqual([64, 64, 64, 64, 64, 64]);
  await who.getByRole("button", { name: "Zoe" }).click();

  // Due: a time that isn't one of the chips, from Pick a time.
  const due = add.getByRole("group", { name: "Due", exact: true });
  await due.getByRole("button", { name: "Pick a time" }).click();
  await add.getByRole("group", { name: "Due: hour" }).getByRole("button", { name: "4 PM" }).click();
  await add
    .getByRole("group", { name: "Due: minutes" })
    .getByRole("button", { name: ":30" })
    .click();
  await expect(due.getByRole("button", { name: "by 4:30 PM" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Repeats: Custom, every 2 weeks on Tuesday and Thursday; the days start on Sunday here.
  // A new task repeats every day until told otherwise, so Custom opens on days.
  await add.getByRole("button", { name: "Custom…" }).click();
  await add.getByRole("button", { name: "Every: more" }).click();
  await add.getByRole("button", { name: "Weeks", exact: true }).click();
  const on = add.getByRole("group", { name: "On", exact: true });
  await expect(on.getByRole("button")).toHaveText([
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ]);
  // Weeks start on the start day's weekday (Wednesday): swap it for Tuesday and Thursday.
  await on.getByRole("button", { name: "Tuesday" }).click();
  await on.getByRole("button", { name: "Thursday" }).click();
  await on.getByRole("button", { name: "Wednesday" }).click();
  await expect(add).toContainText("Every 2 weeks on Tue and Thu");
  await add.getByRole("button", { name: "Add task" }).click();
  await expect(add).toBeHidden();
  await expect(toast(page, "Added Water the garden")).toBeVisible();

  // The rule reached the server and came back: it starts on its first day, Thursday the 8th,
  // is due again the Tuesday and Thursday two weeks on, and not in the week between.
  const tasks = (await (await request.get("/api/chores")).json()) as {
    title: string;
    rrule: string | null;
    start_date: string;
    due_time: string | null;
    repeat_text: string;
  }[];
  const garden = tasks.find((task) => task.title === "Water the garden");
  expect(garden).toMatchObject({
    rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH",
    start_date: "2026-10-08",
    due_time: "16:30",
  });
  const dueOn = async (day: string) => {
    const response = await request.get(`/api/chores/today?date=${day}`);
    const body = (await response.json()) as { columns: { boxes: { title: string }[] }[] };
    return body.columns.some((column) =>
      column.boxes.some((box) => box.title === "Water the garden"),
    );
  };
  expect(await dueOn("2026-10-08")).toBe(true);
  expect(await dueOn("2026-10-13")).toBe(false);
  expect(await dueOn("2026-10-15")).toBe(false);
  expect(await dueOn("2026-10-20")).toBe(true);
  expect(await dueOn("2026-10-22")).toBe(true);
});
