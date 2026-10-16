import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { qk } from "../../api/keys";
import { ShellContext, type ShellKind } from "../../ui/shell";
import { BackupPage } from "./BackupPage";
import { EraseSheet } from "./EraseSheet";

beforeAll(() => {
  // jsdom has no modal dialogs and no animations; these stand in for what the sheet uses.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.getAnimations = () => [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The server's answer to POST /api/admin/erase: right for one password, wrong for the rest. */
function serverTakes(password: string) {
  const sent: unknown[] = [];
  vi.spyOn(api, "POST").mockImplementation(((path: string, init: { body: unknown }) => {
    sent.push([path, init.body]);
    const right = (init.body as { password: string }).password === password;
    return Promise.resolve(
      right
        ? { data: { ok: true }, response: new Response(null, { status: 200 }) }
        : {
            error: {
              error: { code: "wrong_password", message: "That password didn't match. Try again." },
            },
            response: new Response(null, { status: 403 }),
          },
    );
  }) as never);
  return sent;
}

function drawSheet() {
  const onClose = vi.fn();
  const reload = vi.fn(() => Promise.resolve());
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EraseSheet open onClose={onClose} reload={reload} />
    </QueryClientProvider>,
  );
  return { onClose, reload };
}

describe("Erase everything (UX §4 Backup, ADR 0029)", () => {
  it("asks about a copy first, and offers the whole household as a download", () => {
    drawSheet();
    expect(screen.getByRole("dialog", { name: "Erase Everything?" })).toBeTruthy();
    expect(screen.getByText("Keep a copy first?")).toBeTruthy();
    expect(screen.getByText(/photos are deleted for good/)).toBeTruthy();
    expect(screen.queryByLabelText("Household password")).toBeNull();
    const download = screen.getByRole("link", { name: "Download Everything" });
    expect(download.getAttribute("href")).toBe("/api/admin/backups/full.zip");
    expect(download.hasAttribute("download")).toBe(true);
    expect(screen.queryByText(/download has started/)).toBeNull();
    download.addEventListener("click", (event) => {
      event.preventDefault(); // jsdom can't follow it
    });
    fireEvent.click(download);
    expect(screen.getByText("The download has started. Continue once it's saved.")).toBeTruthy();
  });

  it("erases only with the household password, then reloads fresh", async () => {
    const sent = serverTakes("sample-family-passphrase");
    const { reload } = drawSheet();
    fireEvent.click(screen.getByRole("button", { name: "I Have a Copy" }));
    const password = screen.getByLabelText<HTMLInputElement>("Household password");
    expect(password.type).toBe("password");
    const erase = screen.getByRole<HTMLButtonElement>("button", { name: "Erase Everything" });
    expect(erase.disabled).toBe(true);

    fireEvent.change(password, { target: { value: "not-the-password" } });
    fireEvent.click(erase);
    expect(await screen.findByText("That password didn't match. Try again.")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();

    fireEvent.change(password, { target: { value: "sample-family-passphrase" } });
    fireEvent.click(erase);
    await waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
    expect(sent).toEqual([
      ["/api/admin/erase", { password: "not-the-password" }],
      ["/api/admin/erase", { password: "sample-family-passphrase" }],
    ]);
  });

  it("keeps everything when asked to", () => {
    const sent = serverTakes("sample-family-passphrase");
    const { onClose, reload } = drawSheet();
    fireEvent.click(screen.getByRole("button", { name: "I Have a Copy" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Everything" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });
});

function drawPage(deviceKind: "phone" | "kiosk", shell: ShellKind) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(qk.session(), { device_kind: deviceKind });
  client.setQueryData(qk.backups(), {
    last_success_at: null,
    last_error: null,
    stale: false,
    files: [{ name: "sunroom.2026-10-07.db", bytes: 4096 }],
  });
  render(
    <QueryClientProvider client={client}>
      <ShellContext.Provider value={shell}>
        <BackupPage />
      </ShellContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Settings → Backup goes by what the device is, not its size", () => {
  it("gives a laptop its downloads and Start Over, though it shows the wall's shell", () => {
    drawPage("phone", "display");
    expect(screen.getByRole("link", { name: "Download Backup" }).getAttribute("href")).toBe(
      "/api/admin/backups/sunroom.2026-10-07.db",
    );
    expect(screen.getByRole("link", { name: "Download Everything" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export Everything" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start Over" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Erase Everything…" }));
    expect(screen.getByRole("dialog", { name: "Erase Everything?" })).toBeTruthy();
  });

  it("gives a paired screen neither, and no line about them: it has no files, and a child can reach it", () => {
    drawPage("kiosk", "display");
    expect(screen.queryByRole("link", { name: /^Download/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export Everything" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Take Your Data with You" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Start Over" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Erase Everything…" })).toBeNull();
    expect(screen.queryByText(/from a (phone|computer|device)/)).toBeNull();
    expect(screen.getByRole("button", { name: "Back Up Now" })).toBeTruthy();
  });
});
