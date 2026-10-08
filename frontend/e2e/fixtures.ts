import {
  expect,
  test as base,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export const PASSWORD = "e2e-household-passphrase";
export const PIN = "2468";
const CSRF = { "X-Sunroom": "1" };

/**
 * Every test: a server that has never been set up, and a guard that fails the test on any CSP
 * violation, uncaught page error or browser dialog ("never an error wall"), on every page of the
 * test, the wall screen's included.
 */
export const test = base.extend<{
  cspGuard: boolean;
  guard: undefined;
  watch: (page: Page) => void;
}>({
  cspGuard: [true, { option: true }],
  watch: [
    async ({ cspGuard }, use) => {
      const problems: string[] = [];
      await use((page: Page) => {
        page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
        page.on("dialog", (dialog) => {
          problems.push(`dialog: ${dialog.message()}`);
          void dialog.dismiss();
        });
        void page.addInitScript(() => {
          document.addEventListener("securitypolicyviolation", (event) => {
            console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
          });
        });
        page.on("console", (message) => {
          if (cspGuard && message.text().startsWith("CSP violation")) problems.push(message.text());
        });
      });
      expect(problems, "no CSP violations, page errors or dialogs").toEqual([]);
    },
    { scope: "test" },
  ],
  guard: [
    async ({ page, request, watch }, use) => {
      await resetServer(request);
      watch(page);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };

export async function resetServer(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/_test/reset", { headers: CSRF });
  expect(response.status()).toBe(204);
}

/** The synthetic Sample Family, set up through the test API (fake data only). */
export async function seed(
  request: APIRequestContext,
  options: { pin?: string } = {},
): Promise<void> {
  const response = await request.post("/api/_test/seed", {
    headers: CSRF,
    data: options.pin ? { pin: options.pin } : {},
  });
  expect(response.status()).toBe(204);
}

/** A phone (390 × 844, touch) in its own browser context: its own cookies. */
export async function phone(
  browser: Browser,
  watch: (page: Page) => void,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL: "http://127.0.0.1:4173",
    timezoneId: "America/New_York",
    locale: "en-US",
  });
  const page = await context.newPage();
  watch(page);
  return { context, page };
}

/** The wall screen (1920 × 1080, touch) in its own context. */
export async function wall(
  browser: Browser,
  watch: (page: Page) => void,
  viewport = { width: 1920, height: 1080 },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    baseURL: "http://127.0.0.1:4173",
    timezoneId: "America/New_York",
    locale: "en-US",
  });
  const page = await context.newPage();
  watch(page);
  return { context, page };
}

/** Sign a phone in with the household password, and pick a person if asked. */
export async function signInPhone(page: Page, name = "Ana"): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Household password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Who’s using this phone?" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  // On a laptop the Today panel (and its "Up next") shows beside Who's using this, too.
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: "Up next" })).toBeVisible();
}

/** Pair a wall screen through the API with the household password, in its own context. */
export async function pairWall(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/kiosk/pair-with-password", {
    headers: CSRF,
    data: { password: PASSWORD, label: "Kitchen screen" },
  });
  expect(response.status()).toBe(200);
}

/** Wait until every finite animation has ended, so a check sees the final look. */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return typeof end === "number" && Number.isFinite(end);
    });
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
  });
}

/**
 * A scripted calendar account (the test server's stand-in for iCloud or Google) with one
 * calendar, "School", mapped and synced: Settings → Calendars & accounts then shows a real row.
 * `request` must be a parent's (a signed-in phone's `page.request`).
 */
export async function scriptedAccount(request: APIRequestContext): Promise<string> {
  const created = await request.post("/api/calendar-sync/_test/fake", { headers: CSRF });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const scripted = await request.put(`/api/calendar-sync/_test/fake/${id}`, {
    headers: CSRF,
    data: { calendars: [["school", "School", false]] },
  });
  expect(scripted.status()).toBe(200);
  await request.post(`/api/calendar-sync/accounts/${id}/sync`, { headers: CSRF });
  let calendar = "";
  await expect(async () => {
    const accounts = (await (await request.get("/api/calendar-sync/accounts")).json()) as {
      id: string;
      calendars: { id: string }[];
    }[];
    calendar = accounts.find((a) => a.id === id)?.calendars[0]?.id ?? "";
    expect(calendar).not.toBe("");
  }).toPass({ timeout: 10_000 });
  const mapped = await request.put(`/api/calendar-sync/accounts/${id}/calendars/${calendar}`, {
    headers: CSRF,
    data: { mapped: true },
  });
  expect(mapped.status()).toBe(200);
  return id;
}
