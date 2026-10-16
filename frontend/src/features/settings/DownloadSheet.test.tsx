import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DownloadSheet } from "./DownloadSheet";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.getAnimations = () => [];
});

afterEach(cleanup);

describe("Download Which? (UX §4 Backup, ADR 0034)", () => {
  it("offers Data Only and Data & Photos as plain downloads, each made now", () => {
    render(<DownloadSheet open onClose={vi.fn()} />);
    const data = screen.getByRole("link", { name: "Data Only" });
    expect(data.getAttribute("href")).toBe("/api/admin/backups/data.db");
    expect(data.hasAttribute("download")).toBe(true);
    const everything = screen.getByRole("link", { name: "Data & Photos" });
    expect(everything.getAttribute("href")).toBe("/api/admin/backups/full.zip");
    expect(screen.getByText(/A checked copy of the data made now/)).toBeTruthy();
    expect(screen.getByText(/photos included: this can take a while/)).toBeTruthy();
    expect(screen.queryByText(/The download has started/)).toBeNull();
  });

  it("says the download started, then closes", () => {
    const onClose = vi.fn();
    render(<DownloadSheet open onClose={onClose} />);
    const data = screen.getByRole("link", { name: "Data Only" });
    data.addEventListener("click", (event) => {
      event.preventDefault(); // jsdom can't follow it
    });
    fireEvent.click(data);
    expect(
      screen.getByText("The download has started. It's saved when your browser says so."),
    ).toHaveProperty("role", "status");
    // The sheet's own ✕ is named Close too; this is the one under the line, after it.
    const close = screen.getAllByRole("button", { name: "Close" }).at(-1);
    if (!close) throw new Error("no Close under the line");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
