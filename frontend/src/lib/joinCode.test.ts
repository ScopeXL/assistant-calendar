import { describe, expect, it } from "vitest";

import { codeFromHash, displayCode, normalizeCode, spokenCode } from "./joinCode";

describe("pair codes", () => {
  it("accepts what people type", () => {
    expect(normalizeCode("7K4M9X")).toBe("7K4M9X");
    expect(normalizeCode("7k4 m9x")).toBe("7K4M9X");
    expect(normalizeCode(" 7K4-M9X ")).toBe("7K4M9X");
  });

  it("refuses what can't be a code", () => {
    expect(normalizeCode("7K4M9")).toBeNull(); // too short
    expect(normalizeCode("7K4M90")).toBeNull(); // 0 isn't used: it looks like O
    expect(normalizeCode("")).toBeNull();
  });

  it("reads the code from a QR link and shows it in two groups", () => {
    expect(codeFromHash("#7K4M9X")).toBe("7K4M9X");
    expect(codeFromHash("")).toBeNull();
    expect(displayCode("7K4M9X")).toBe("7K4 M9X");
    expect(spokenCode("7K4M9X")).toBe("7 K 4 M 9 X");
  });
});
