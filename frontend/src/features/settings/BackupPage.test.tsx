import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { qk } from "../../api/keys";
import { setDatePreferences } from "../../lib/dates";
import { toasts } from "../../lib/toast";
import { ShellContext, type ShellKind } from "../../ui/shell";
import { BackupPage } from "./BackupPage";
import { copyDetail, copyWhen, sizeWords, weeksWords, type BackupCopy } from "./backupWords";

beforeAll(() => {
  // jsdom has no modal dialogs and no animations; these stand in for what the sheets use.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.getAnimations = () => [];
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toasts.set([]);
});

const NIGHTLY: BackupCopy = {
  name: "sunroom.2026-10-07.db",
  kind: "nightly",
  made_at: "2026-10-07T03:30:00-04:00",
  bytes: 4.2 * 1024 * 1024,
};
const BEFORE_UPGRADE: BackupCopy = {
  name: "sunroom.202610151730.20261006T120000Z.db",
  kind: "pre-migrate",
  made_at: "2026-10-06T08:00:00-04:00",
  bytes: 4.1 * 1024 * 1024,
};

function drawPage(
  deviceKind: "phone" | "kiosk",
  shell: ShellKind,
  {
    files = [NIGHTLY, BEFORE_UPGRADE],
    enabled = true,
    busy = false,
    last = null as Record<string, unknown> | null,
  } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(qk.session(), { device_kind: deviceKind });
  client.setQueryData(qk.settings(), {
    backups_enabled: enabled,
    backups_keep_daily: 14,
    backups_keep_weekly: 8,
  });
  client.setQueryData(qk.backups(), {
    enabled,
    keep_daily: 14,
    keep_weekly: 8,
    busy,
    last_success_at: null,
    last_error: null,
    stale: false,
    files,
  });
  client.setQueryData(qk.restore(), { staged: null, last });
  render(
    <QueryClientProvider client={client}>
      <ShellContext.Provider value={shell}>
        <BackupPage />
      </ShellContext.Provider>
    </QueryClientProvider>,
  );
}

describe("the words for a copy (UX §4 Backup)", () => {
  it("says when, what made it and how big it is", () => {
    expect(copyWhen(NIGHTLY.made_at)).toBe("Wed, Oct 7, 3:30 AM");
    expect(copyDetail(NIGHTLY)).toBe("Nightly · 4.2 MB");
    expect(copyDetail(BEFORE_UPGRADE)).toBe("Before an upgrade · 4.1 MB");
    expect(sizeWords(820 * 1024)).toBe("820 KB");
    expect(sizeWords(12)).toBe("1 KB");
    expect(weeksWords(0)).toBe("None");
    expect(weeksWords(1)).toBe("1 week");
  });
});

describe("Settings → Backup goes by what the device is, not its size (ADR 0034)", () => {
  it("gives a laptop every group, though it shows the wall's shell", () => {
    drawPage("phone", "display");
    for (const heading of [
      "Backups",
      "Copies on the Server",
      "Download",
      "Restore from a File",
      "Take Your Data with You",
      "Start Over",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Back Up Now" })).toBeTruthy();
    expect(screen.getByText("Wed, Oct 7, 3:30 AM")).toBeTruthy();
    expect(screen.getByText("Nightly · 4.2 MB")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Download the copy from Wed, Oct 7, 3:30 AM" }),
    ).toHaveProperty(
      "href",
      expect.stringMatching(/\/api\/admin\/backups\/sunroom\.2026-10-07\.db$/),
    );
    expect(
      screen.getByRole("button", { name: "Remove the copy from Wed, Oct 7, 3:30 AM" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    const choose = screen.getByLabelText<HTMLInputElement>("Choose a File…");
    expect(choose.type).toBe("file");
    expect(choose.accept).toBe(".db,.zip,application/zip,application/vnd.sqlite3");
    fireEvent.click(screen.getByRole("button", { name: "Download…" }));
    const sheet = screen.getByRole("dialog", { name: "Download Which?" });
    expect(sheet).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Erase Everything…" }));
    expect(screen.getByRole("dialog", { name: "Erase Everything?" })).toBeTruthy();
  });

  it("gives a paired screen the backups and the copies, and nothing that saves or sends a file", () => {
    drawPage("kiosk", "display");
    expect(screen.getByRole("heading", { name: "Backups" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Copies on the Server" })).toBeTruthy();
    expect(screen.getByText("Wed, Oct 7, 3:30 AM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back Up Now" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: /^Nightly backups/ })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Start Over" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Restore from a File" })).toBeNull();
    expect(screen.queryByLabelText("Choose a File…")).toBeNull();
    // No line about what only a signed-in device can do.
    expect(screen.queryByText(/Data & Photos|from a (phone|computer|device)/)).toBeNull();
  });

  it("says why the last restore didn't go through", () => {
    drawPage("phone", "phone", {
      last: {
        ok: false,
        at: "2026-10-07T14:00:00+00:00",
        file_name: "sunroom.db",
        problem: "The copy to restore didn't pass its check.",
        previous: null,
        photos: null,
      },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "The last restore didn't go through: The copy to restore didn't pass its check.",
    );
  });

  it("says when there are no copies yet, and why", () => {
    drawPage("phone", "phone", { files: [] });
    expect(screen.getByText("No copies yet. The first nightly copy comes tonight.")).toBeTruthy();
    cleanup();
    drawPage("phone", "phone", { files: [], enabled: false });
    expect(screen.getByText("No copies yet. Back Up Now makes one.")).toBeTruthy();
  });
});

describe("the nightly copies (ADR 0034)", () => {
  it("hides the counts when they're off, and saves the switch at once", async () => {
    const patch = vi.spyOn(api, "PATCH").mockImplementation((() =>
      Promise.resolve({
        data: { backups_enabled: false, backups_keep_daily: 14, backups_keep_weekly: 8 },
        response: new Response(null, { status: 200 }),
      })) as never);
    drawPage("phone", "phone");
    expect(screen.getByRole("group", { name: "Daily copies to keep" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Weekly copies to keep" })).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: /^Nightly backups/ }));
    await waitFor(() => {
      expect(screen.queryByRole("group", { name: "Daily copies to keep" })).toBeNull();
    });
    expect(screen.queryByRole("group", { name: "Weekly copies to keep" })).toBeNull();
    expect(patch).toHaveBeenCalledWith("/api/settings", { body: { backups_enabled: false } });
  });

  it("changes how many stay with the steppers", async () => {
    const patch = vi
      .spyOn(api, "PATCH")
      .mockImplementation((() =>
        Promise.resolve({ data: {}, response: new Response(null, { status: 200 }) })) as never);
    drawPage("phone", "phone");
    fireEvent.click(screen.getByRole("button", { name: "Weekly copies to keep: less" }));
    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("/api/settings", { body: { backups_keep_weekly: 7 } });
    });
  });
});

describe("removing a copy", () => {
  it("asks once, then removes it and says which went", async () => {
    const remove = vi.spyOn(api, "DELETE").mockImplementation((() =>
      Promise.resolve({
        data: undefined,
        response: new Response(null, { status: 204 }),
      })) as never);
    drawPage("phone", "phone");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove the copy from Wed, Oct 7, 3:30 AM" }),
    );
    const sheet = screen.getByRole("dialog", { name: "Remove This Copy?" });
    expect(sheet.textContent).toContain("The copy from Wed, Oct 7, 3:30 AM goes for good.");
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("/api/admin/backups/{name}", {
        params: { path: { name: "sunroom.2026-10-07.db" } },
      });
    });
    await waitFor(() => {
      expect(toasts.get().map((toast) => toast.message)).toContain("Removed the copy from Oct 7");
    });
  });

  it("keeps it when asked to, and can't while a backup is written", () => {
    const remove = vi.spyOn(api, "DELETE");
    drawPage("phone", "phone");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove the copy from Wed, Oct 7, 3:30 AM" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep It" }));
    expect(remove).not.toHaveBeenCalled();
    cleanup();
    drawPage("phone", "phone", { busy: true });
    expect(screen.getByText("A backup is being written.")).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Remove the copy from Wed, Oct 7, 3:30 AM",
      }).disabled,
    ).toBe(true);
  });
});
