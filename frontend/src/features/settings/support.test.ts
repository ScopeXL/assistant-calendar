import { describe, expect, it } from "vitest";

import { FEEDBACK_URL_MAX, REPO_URL, feedbackUrl, installWords } from "./support";

const params = (url: string) => new URL(url).searchParams;

describe("Send Feedback's link (ADR 0034)", () => {
  it("opens GitHub's new issue with the kind, the words and the version filled in", () => {
    const url = feedbackUrl({
      kind: "problem",
      title: "  The wall froze ",
      body: "It stopped at 3 AM & didn't wake? 100%",
      version: "0.12.0",
      install: "Docker",
    });
    expect(
      url.startsWith(`${REPO_URL}/issues/new?title=Problem%3A%20The%20wall%20froze&body=`),
    ).toBe(true);
    expect(params(url).get("title")).toBe("Problem: The wall froze");
    expect(params(url).get("body")).toBe(
      "It stopped at 3 AM & didn't wake? 100%\n\n---\nSunroom 0.12.0, Docker",
    );
  });

  it("calls an idea an idea, and leaves out what it doesn't know", () => {
    const url = feedbackUrl({
      kind: "idea",
      title: "Dark tiles",
      body: "",
      version: "0.12.0",
      install: null,
    });
    expect(params(url).get("title")).toBe("Idea: Dark tiles");
    expect(params(url).get("body")).toBe("---\nSunroom 0.12.0");
  });

  it("cuts long words to keep the link a QR code can hold, never the title or the version", () => {
    const url = feedbackUrl({
      kind: "problem",
      title: "Too long",
      body: "é".repeat(1500),
      version: "0.12.0",
      install: "a Raspberry Pi",
    });
    expect(url.length).toBeLessThanOrEqual(FEEDBACK_URL_MAX);
    expect(params(url).get("title")).toBe("Problem: Too long");
    const body = params(url).get("body") ?? "";
    expect(body.endsWith("…\n\n---\nSunroom 0.12.0, a Raspberry Pi")).toBe(true);
    expect(body.length).toBeGreaterThan(100);
  });

  it("says where the server runs in words", () => {
    expect(installWords("docker")).toBe("Docker");
    expect(installWords("pi")).toBe("a Raspberry Pi");
    expect(installWords("portainer")).toBe("Portainer");
    expect(installWords("computer")).toBe("a computer");
    expect(installWords("ha")).toBe("Home Assistant");
    expect(installWords(undefined)).toBeNull();
  });
});
