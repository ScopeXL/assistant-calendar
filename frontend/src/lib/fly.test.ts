import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flyPoints, landingFor } from "./fly";

const MIA = "0192a0c0-0000-7000-8000-00000000000a";

function placed(element: HTMLElement, left: number, top: number, size = 40): HTMLElement {
  element.getBoundingClientRect = () => new DOMRect(left, top, size, size);
  return element;
}

function avatar(memberId: string, parent: HTMLElement, left: number, top: number): HTMLElement {
  const element = placed(document.createElement("span"), left, top);
  element.dataset.pointsTo = memberId;
  parent.appendChild(element);
  return element;
}

describe("flyPoints", () => {
  let animate: ReturnType<typeof vi.fn>;
  let landed: () => void;

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
    })) as unknown as typeof window.matchMedia;
    animate = vi.fn(() => ({
      finished: new Promise<void>((resolve) => {
        landed = resolve;
      }),
    }));
    HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;
  });

  afterEach(() => {
    document.body.replaceChildren();
    delete document.documentElement.dataset.reduceMotion;
  });

  it("lands on the Today panel's avatar before the column's", () => {
    const header = avatar(MIA, document.body, 100, 100);
    const panel = document.createElement("aside");
    panel.setAttribute("aria-label", "Today");
    document.body.appendChild(panel);
    const today = avatar(MIA, panel, 900, 200);
    expect(landingFor(MIA)).toBe(today);
    panel.remove();
    expect(landingFor(MIA)).toBe(header);
  });

  it("skips an avatar that's off screen", () => {
    avatar(MIA, document.body, 100, window.innerHeight + 50);
    expect(landingFor(MIA)).toBeNull();
  });

  it("rises from the box, flies to the avatar, and bumps it as it lands", async () => {
    const target = avatar(MIA, document.body, 900, 200);
    const box = placed(document.createElement("div"), 100, 500, 72);
    expect(flyPoints({ from: box, memberId: MIA, points: 2, display: true })).toBe(true);
    const flier = document.body.querySelector("span[aria-hidden]:not([data-points-to])");
    expect(flier?.textContent).toBe("+2");
    expect(animate).toHaveBeenCalledOnce();
    landed();
    await Promise.resolve();
    expect(document.body.contains(flier)).toBe(false);
    expect(target.classList.contains("bump")).toBe(true);
  });

  it("leaves the row's own rise when there's nowhere to land", () => {
    const box = placed(document.createElement("div"), 100, 500, 72);
    expect(flyPoints({ from: box, memberId: MIA, points: 2, display: true })).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });

  it("doesn't fly with Reduce Motion", () => {
    avatar(MIA, document.body, 900, 200);
    document.documentElement.dataset.reduceMotion = "";
    const box = placed(document.createElement("div"), 100, 500, 72);
    expect(flyPoints({ from: box, memberId: MIA, points: 2, display: true })).toBe(true);
    expect(animate).not.toHaveBeenCalled();
  });
});
