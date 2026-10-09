/**
 * M0's flow (PLAN §15 M0 Verify): first run on a phone, pair the wall screen, the PIN gate on the
 * wall, sign out. One test drives both: a phone context and the wall (this project's page).
 * Synthetic names only.
 */
import { expect, phone, PIN, PASSWORD, test, wall } from "./fixtures";

const ONLY = "display-1080p";
const WHY = "drives its own phone and wall contexts";

test("first run on a phone, the wall paired, Settings behind the PIN, then sign out", async ({
  page,
  browser,
  watch,
}, testInfo) => {
  test.skip(testInfo.project.name !== ONLY, WHY);
  test.setTimeout(60_000);
  // Before setup, the wall says where to set Sunroom up.
  await page.goto("/display");
  await expect(page.getByRole("heading", { name: "Set up Sunroom on your phone" })).toBeVisible();
  await expect(page.getByText("http://sunroom.local:4173")).toBeVisible();
  await expect(page.getByRole("img", { name: /A code that opens/ })).toBeVisible();

  const { page: phonePage, context } = await phone(browser, watch);
  await phonePage.goto("/");
  await expect(phonePage).toHaveURL(/\/setup/);
  await phonePage.getByRole("button", { name: "Start" }).click();
  await phonePage.getByLabel("Household password").fill(PASSWORD);
  await phonePage.getByRole("button", { name: "Next" }).click();
  await phonePage.getByLabel("Household name").fill("Sample Family");
  await phonePage.getByRole("button", { name: "Monday" }).click();
  await phonePage.getByRole("button", { name: "Next" }).click();

  // Where's home? The test server's place search knows Sample Town.
  await expect(phonePage.getByRole("heading", { name: "Where’s home?" })).toBeVisible();
  await phonePage.getByLabel("Your town").fill("Sample");
  await phonePage.getByRole("button", { name: "Search" }).click();
  await phonePage.getByRole("button", { name: /^Sample Town/ }).click();

  // Who lives here? Start with you, then a child.
  await expect(phonePage.getByRole("heading", { name: "Who lives here?" })).toBeVisible();
  await phonePage.getByLabel("Your name").fill("Ana");
  await phonePage.getByRole("button", { name: "Add me" }).click();
  await phonePage.getByLabel("Name", { exact: true }).fill("Mia");
  await phonePage.getByRole("button", { name: "Child", exact: true }).click();
  // One row: the name, Child, Add. The name clears for the next person; Child stays chosen.
  await phonePage.getByRole("button", { name: "Add", exact: true }).click();
  await expect(phonePage.getByRole("listitem").filter({ hasText: "Mia" })).toContainText("Child");
  await expect(phonePage.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(phonePage.getByRole("button", { name: "Child", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(phonePage.getByRole("button", { name: "Add another" })).toHaveCount(0);
  await phonePage.getByRole("button", { name: "Next", exact: true }).click();

  await phonePage.getByLabel("PIN (4 to 6 digits)").fill(PIN);
  await phonePage.getByRole("button", { name: "Set a PIN" }).click();

  // The wall now shows its pair code; the phone types it.
  await expect(phonePage.getByRole("heading", { name: "Pair the kitchen screen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pair this screen" })).toBeVisible({
    timeout: 15_000,
  });
  const code = (await page.getByTestId("pair-code").textContent()) ?? "";
  expect(code).toMatch(/^[A-Z2-9]{3} [A-Z2-9]{3}$/);
  await phonePage.getByLabel("The code on the screen").fill(code);
  await phonePage.getByRole("button", { name: "Pair", exact: true }).click();

  // The wall moves on by itself: name it, then the board.
  await expect(page.getByRole("heading", { name: "Name this screen" })).toBeVisible();
  await page.getByRole("button", { name: "Kitchen" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  const board = page.getByRole("region", { name: "This Week" });
  await expect(board).toBeVisible();
  await expect(board.locator("[aria-current=date]")).toContainText("today");
  // The board measures with an invisible copy of each column; the visible line is the one.
  await expect(board.getByText(/^now \d{1,2}:\d{2}/).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Rooms" })).toContainText(/\d{1,2}:\d{2}/);
  // The household starts its week on Monday now.
  await expect(board.getByRole("heading", { level: 2 }).first()).toContainText("Mon");

  await expect(phonePage.getByRole("heading", { name: "Bring in your calendars" })).toBeVisible();
  await phonePage.getByRole("button", { name: "Skip for now" }).click();
  await expect(phonePage.getByRole("heading", { name: "You’re set" })).toBeVisible();
  await phonePage.getByRole("button", { name: "Open Sunroom" }).click();
  await expect(phonePage.getByRole("heading", { name: "Up next" })).toBeVisible();

  // Settings on the wall are behind the PIN.
  await page.getByRole("button", { name: "Settings" }).click();
  const pin = page.getByRole("dialog", { name: "Parent PIN" });
  await expect(pin).toBeVisible();
  for (const digit of "1357") await pin.getByRole("button", { name: digit, exact: true }).click();
  await expect(pin.getByRole("alert")).toHaveText("That PIN didn't match. Try again.");
  for (const digit of PIN) await pin.getByRole("button", { name: digit, exact: true }).click();
  await expect(pin).toBeHidden();
  await expect(page.getByRole("heading", { name: "Family", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change Mia" })).toBeVisible();
  await page.getByRole("button", { name: "Lock" }).click();
  await expect(board).toBeVisible();
  // Locked again: Settings asks for the PIN once more.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Parent PIN" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Parent PIN" })
    .getByRole("button", { name: "Cancel" })
    .click();

  // The phone signs itself out from Phones & Screens.
  await phonePage.getByRole("link", { name: "More" }).click();
  await phonePage.getByRole("link", { name: "Settings" }).click();
  await phonePage.getByRole("link", { name: "Phones & Screens" }).click();
  await expect(phonePage.getByText("Kitchen screen")).toBeVisible();
  await phonePage.getByRole("button", { name: "Sign out of this phone" }).click();
  await expect(phonePage).toHaveURL(/\/sign-in/);
  await context.close();
});

test("a wall screen typed in with the password, and a toast that leaves under the CSP", async ({
  request,
  browser,
  watch,
}, testInfo) => {
  test.skip(testInfo.project.name !== ONLY, WHY);
  await request.post("/api/_test/seed", { headers: { "X-Sunroom": "1" }, data: { pin: PIN } });
  const { page: screen, context } = await wall(browser, watch);
  await screen.goto("/display");
  await screen.getByRole("button", { name: "Type the household password here instead" }).click();
  const field = screen.getByLabel("Household password");
  await field.click();
  // The on-screen keyboard rises; type the first letters with it, the rest directly.
  const keyboard = screen.getByRole("group", { name: "On-screen keyboard" });
  await expect(keyboard).toBeVisible();
  await keyboard.getByRole("button", { name: "e", exact: true }).click();
  await expect(field).toHaveValue("e"); // a password: no automatic capital
  await field.fill(PASSWORD);
  await screen.getByRole("button", { name: "Pair this screen" }).click();
  await expect(screen.getByRole("heading", { name: "Name this screen" })).toBeVisible();
  await screen.getByRole("button", { name: "Done" }).click();
  await expect(screen.getByRole("region", { name: "This Week" })).toBeVisible();

  // From here on the page is the service worker's cached index.html, whose CSP header and
  // nonce were stamped together when it was cached (ADR 0007).
  await screen.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await screen.reload();
  await expect(screen.getByRole("region", { name: "This Week" })).toBeVisible();
  expect(await screen.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  const nonce = await screen.locator('meta[name="csp-nonce"]').getAttribute("content");
  expect(nonce).toMatch(/^[\w+/=-]{16,}$/);

  // Settings → Family → remove Mia, then Undo: the toast rises and leaves with `motion`, whose
  // style block carries the page's nonce, while the CSP guard watches (ADR 0007).
  await screen.getByRole("button", { name: "Settings" }).click();
  const pin = screen.getByRole("dialog", { name: "Parent PIN" });
  for (const digit of PIN) await pin.getByRole("button", { name: digit, exact: true }).click();
  await screen.getByRole("button", { name: "Change Mia" }).click();
  const sheet = screen.getByRole("dialog", { name: "Change Mia" });
  await sheet.getByRole("button", { name: "Remove Mia" }).click();
  await sheet.getByRole("button", { name: "Remove Mia" }).click();
  const toast = screen.locator("[data-toast]").filter({ hasText: "Removed Mia" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(toast).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "Change Mia" })).toBeVisible();
  await context.close();
});
