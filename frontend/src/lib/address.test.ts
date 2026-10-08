import { describe, expect, it } from "vitest";

import { isLoopbackAddress } from "./address";

describe("loopback addresses", () => {
  it.each([
    "http://localhost:8080",
    "http://127.0.0.1:4173",
    "http://[::1]:8080",
    "http://app.localhost",
  ])("%s is only for this computer", (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each([
    "http://sunroom.local:8080",
    "https://calendar.example.com",
    "http://192.168.1.20:8080",
    "not a url",
  ])("%s is not", (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});
