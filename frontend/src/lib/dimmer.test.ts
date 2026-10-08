import { beforeEach, describe, expect, it } from "vitest";

import { noteDimmer } from "./dimmer";

beforeEach(() => {
  window.localStorage.clear();
});

describe("who dims the wall", () => {
  it("is the page unless the Pi's launcher says the screen does it", () => {
    expect(noteDimmer("")).toBe("page");
    expect(noteDimmer("?dimmer=screen")).toBe("screen");
  });

  it("remembers the launcher's word across a reload without it", () => {
    noteDimmer("?dimmer=screen");
    expect(noteDimmer("")).toBe("screen");
    noteDimmer("?dimmer=page");
    expect(noteDimmer("")).toBe("page");
    expect(noteDimmer("?dimmer=nonsense")).toBe("page");
  });
});
