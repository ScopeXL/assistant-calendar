/**
 * Settings → Backup end to end (UX §4 Backup, ADR 0034): on a computer, the nightly copies with
 * their counts, Back Up Now beside the heading, a Data Only download made now, and a copy
 * removed after one question; on a paired screen, the backups and the copies and nothing that
 * saves or sends a file. Each test starts with no copies on the server. Synthetic data only.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, pairWall, seed, signInPhone, test, wall } from "./fixtures";

/** A settings group: its heading's section. */
function group(page: Page, name: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("Backup on a computer: nightly on with its counts, Back Up Now in the heading, a Data Only download and a copy removed", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "a computer saves the files");
  await seed(request);
  await signInPhone(page);
  await page.goto("/settings/backup");
  const backups = group(page, "Backups");
  const nightly = backups.getByRole("switch", { name: /^Nightly backups/ });
  await expect(nightly).toBeChecked();
  await expect(backups.getByRole("group", { name: "Daily copies to keep" })).toContainText(
    "14 days",
  );
  await expect(backups.getByRole("group", { name: "Weekly copies to keep" })).toContainText(
    "8 weeks",
  );

  // Off, the counts go and nothing is made at night; the switch saves as it changes.
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings") && response.request().method() === "PATCH",
  );
  await nightly.click();
  expect((await saved).ok()).toBe(true);
  await expect(backups.getByRole("group", { name: "Daily copies to keep" })).toHaveCount(0);
  const copies = group(page, "Copies on the Server");
  await expect(copies.getByText("No copies yet. Back Up Now makes one.")).toBeVisible();

  // Back Up Now sits beside the heading, and makes a copy all the same.
  const heading = backups.getByRole("heading", { name: "Backups", exact: true });
  await expect(
    heading.locator("xpath=..").getByRole("button", { name: "Back Up Now" }),
  ).toBeVisible();
  await backups.getByRole("button", { name: "Back Up Now" }).click();
  await expect(page.locator("[data-toast]").filter({ hasText: "Backed up" })).toBeVisible();
  await expect(copies.getByText(/^Nightly · /)).toHaveCount(1);

  // Download → Data Only: a copy made now, saved by the browser.
  await page.getByRole("button", { name: "Download…" }).click();
  const which = page.getByRole("dialog", { name: "Download Which?" });
  await expect(which.getByRole("link", { name: "Data & Photos" })).toHaveAttribute(
    "href",
    "/api/admin/backups/full.zip",
  );
  const download = page.waitForEvent("download");
  await which.getByRole("link", { name: "Data Only" }).click();
  expect((await download).suggestedFilename()).toMatch(/^sunroom-\d{4}-\d{2}-\d{2}\.db$/);
  await expect(
    which.getByText("The download has started. It's saved when your browser says so."),
  ).toBeVisible();
  await which.getByRole("button", { name: "Close" }).last().click();
  await expect(which).toBeHidden();

  // Remove asks once, because nothing can bring a copy back.
  await copies.getByRole("button", { name: /^Remove the copy from / }).click();
  const ask = page.getByRole("dialog", { name: "Remove This Copy?" });
  await expect(ask.getByText(/goes for good\.$/)).toBeVisible();
  await ask.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.locator("[data-toast]").filter({ hasText: /^Removed the copy from / }),
  ).toBeVisible();
  await expect(copies.getByText("No copies yet. Back Up Now makes one.")).toBeVisible();

  // On again: the counts are back, as they were.
  await nightly.click();
  await expect(backups.getByRole("group", { name: "Daily copies to keep" })).toContainText(
    "14 days",
  );
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

test("a paired screen sees the backups switch and the copies, and nothing that saves or sends a file", async ({
  request,
  browser,
  watch,
}, testInfo) => {
  test.skip(testInfo.project.name !== "display-1080p", "drives its own wall context");
  await seed(request); // no PIN: the wall opens Settings itself
  const { page: screen, context } = await wall(browser, watch);
  await pairWall(screen);
  await screen.goto("/settings/backup");
  const backups = group(screen, "Backups");
  await expect(backups.getByRole("switch", { name: /^Nightly backups/ })).toBeChecked();
  await backups.getByRole("button", { name: "Back Up Now" }).click();
  const copies = group(screen, "Copies on the Server");
  await expect(copies.getByText(/^Nightly · /)).toHaveCount(1);
  // The list, with no buttons; no Download, Export or Start Over; no line about them.
  await expect(screen.locator('a[href^="/api/"]')).toHaveCount(0);
  await expect(screen.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "Download…" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "Export" })).toHaveCount(0);
  await expect(screen.getByRole("heading", { name: "Start Over" })).toHaveCount(0);
  await expect(screen.getByText(/Data & Photos|from a (phone|computer|device)/i)).toHaveCount(0);
  await context.close();
});
