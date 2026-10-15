/**
 * The forecast on the wall screen (UX §3, ADR 0033): a tap on the header's weather opens a sheet
 * titled with the household's place without its country, on one line however long the name;
 * Today, a line on the weather now with the day's high and low, then the next twelve hours; and
 * Forecast, the days ahead. The server's clock reads Wednesday, October 7, 2026, 10:00 AM in New
 * York, and the test server's forecast is made up. Synthetic data only.
 */
import { expect, pairWall, PASSWORD, seed, test } from "./fixtures";

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

test("the forecast names the place without its country, on one line, with Today and Forecast", async ({
  page,
  request,
}) => {
  const parent = await request.post("/api/auth/login", {
    headers: CSRF,
    data: { password: PASSWORD },
  });
  expect(parent.ok()).toBe(true);
  // The place as the city search names it; the seed's own place stays, so the forecast does.
  const place = (location_label: string) =>
    request.patch("/api/settings", { headers: CSRF, data: { location_label } });
  expect((await place("Sample Town, Sample State, United States")).ok()).toBe(true);
  await pairWall(page);
  await page.goto("/display");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^The weather/ })
    .click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAccessibleName("Sample Town, Sample State");
  const title = sheet.getByRole("heading", { level: 2 });
  await expect(title).toHaveText("Sample Town, Sample State");
  // One line: a second would make it 80 px at Standard.
  expect((await title.boundingBox())?.height ?? 0).toBeLessThan(60);
  await expect(sheet.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Forecast", exact: true })).toBeVisible();
  const today = sheet.getByRole("region", { name: "Today", exact: true });
  await expect(today.getByText(/now\. High \d+°, low \d+°\./)).toBeVisible();
  // The next twelve hours start at this one.
  await expect(today.getByRole("listitem")).toHaveCount(12);
  await expect(today.getByRole("listitem").first()).toContainText("10 AM");

  // A name too long for the line is cut short rather than wrapped, and still names the sheet.
  // The open sheet follows the change (settings.changed refreshes the forecast).
  const long = "Sample Town on the Long and Winding Sample River, Sample State";
  expect((await place(`${long}, United States`)).ok()).toBe(true);
  await expect(title).toHaveText(long);
  expect((await title.boundingBox())?.height ?? 0).toBeLessThan(60);
  expect(await title.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect(sheet).toHaveAccessibleName(long);

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});
