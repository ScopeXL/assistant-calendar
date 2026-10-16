import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "../../api/client";
import { setDatePreferences } from "../../lib/dates";
import { forgetRestart, restarting } from "../../lib/restart";
import type { RestoreSummary } from "../../lib/restoreUpload";
import { holdsWords, madeWords, RestoreSheet } from "./RestoreSheet";

beforeAll(() => {
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
  forgetRestart();
});

const ZIP: RestoreSummary = {
  file_name: "sunroom-2026-10-07.zip",
  kind: "zip",
  bytes: 9_000_000,
  app_version: "0.11.0",
  schema_revision: "202610151730",
  needs_upgrade: true,
  created_at: "2026-10-07T19:00:00+00:00",
  row_counts: { members: 4, events: 12, lists: 3 },
  photo_files: 6,
};

const sent = (file: File, onProgress: (fraction: number) => void) => {
  onProgress(0.42);
  return Promise.resolve({ ...ZIP, file_name: file.name });
};

function draw(upload: typeof sent = sent) {
  const onClose = vi.fn();
  const file = new File(["zip"], "sunroom-2026-10-07.zip", { type: "application/zip" });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RestoreSheet file={file} onClose={onClose} upload={upload} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("what a backup holds, in words", () => {
  it("says when it was made, by which Sunroom, and what's in it", () => {
    expect(madeWords(ZIP)).toBe(
      "sunroom-2026-10-07.zip, made Wed, Oct 7, 3:00 PM by Sunroom 0.11.0.",
    );
    expect(holdsWords(ZIP)).toBe("It holds 4 people, 12 events, 3 lists and 6 photos.");
    const db: RestoreSummary = { ...ZIP, kind: "db", created_at: null, photo_files: 0 };
    expect(madeWords({ ...db, file_name: "sunroom.db" })).toBe("sunroom.db, from Sunroom 0.11.0.");
    expect(holdsWords({ ...db, row_counts: { members: 1, events: 1, lists: 0 } })).toBe(
      "It holds 1 person, 1 event and 0 lists.",
    );
  });
});

describe("Restore from a File? (ADR 0034)", () => {
  it("sends the file, shows what it holds, asks the password, then waits for Sunroom", async () => {
    const apply = vi.spyOn(api, "POST").mockImplementation((() =>
      Promise.resolve({
        data: { ok: true },
        response: new Response(null, { status: 200 }),
      })) as never);
    draw();
    expect(
      await screen.findByText(
        "sunroom-2026-10-07.zip, made Wed, Oct 7, 3:00 PM by Sunroom 0.11.0.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("It holds 4 people, 12 events, 3 lists and 6 photos.")).toBeTruthy();
    expect(
      screen.getByText("This copy is older than this Sunroom: it will be brought up to date."),
    ).toBeTruthy();
    expect(screen.queryByText("Photos on the server stay as they are.")).toBeNull();
    expect(screen.getByText(/is kept as a copy before the restore/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restore This Copy…" }));
    const password = screen.getByLabelText<HTMLInputElement>("Household password");
    expect(password.type).toBe("password");
    const restore = screen.getByRole<HTMLButtonElement>("button", { name: "Restore" });
    expect(restore.disabled).toBe(true);
    fireEvent.change(password, { target: { value: "sample-family-passphrase" } });
    fireEvent.click(restore);

    expect(await screen.findByText(/^Restoring… Sunroom restarts with the copy\./)).toBeTruthy();
    expect(apply).toHaveBeenCalledWith("/api/admin/restore/apply", {
      body: { password: "sample-family-passphrase" },
    });
    // The shell's waiter reloads the page once Sunroom is back (lib/restart).
    expect(restarting.get()).toBe("restore");
  });

  it("says a wrong password, and restores nothing", async () => {
    vi.spyOn(api, "POST").mockImplementation((() =>
      Promise.resolve({
        error: {
          error: { code: "wrong_password", message: "That password didn't match. Try again." },
        },
        response: new Response(null, { status: 403 }),
      })) as never);
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Restore This Copy…" }));
    fireEvent.change(screen.getByLabelText("Household password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("That password didn't match. Try again.")).toBeTruthy();
    expect(restarting.get()).toBeNull();
  });

  it("forgets the file on the server when closed before restoring", async () => {
    const discard = vi.spyOn(api, "DELETE").mockImplementation((() =>
      Promise.resolve({
        data: undefined,
        response: new Response(null, { status: 204 }),
      })) as never);
    const { onClose } = draw();
    fireEvent.click(await screen.findByRole("button", { name: "Keep Everything" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(discard).toHaveBeenCalledWith("/api/admin/restore");
    });
  });

  it("gives the server's reason when the file can't be restored", async () => {
    const refused = () =>
      Promise.reject(
        new ApiError(
          422,
          "not_a_backup",
          "That file isn't a Sunroom backup. Restore takes a .db file or the .zip from Download everything.",
        ),
      );
    draw(refused);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "That file isn't a Sunroom backup. Restore takes a .db file or the .zip from Download everything.",
    );
    expect(screen.queryByRole("button", { name: "Restore This Copy…" })).toBeNull();
  });

  it("shows how far the file got while it's sent", () => {
    draw(() => new Promise(() => undefined));
    expect(screen.getByRole("progressbar", { name: "Sending" })).toBeTruthy();
    expect(screen.getByText("Sending… 0%")).toBeTruthy();
  });
});
