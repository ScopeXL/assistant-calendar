/**
 * House rules that are easy to break by accident (UX §1, §7, ADR 0007). Reads every source file
 * as text.
 */
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(
  ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../api/schema.d.ts"],
  { query: "?raw", import: "default", eager: true },
);

function offenders(pattern: RegExp, except: string[] = []): string[] {
  return Object.entries(sources)
    .filter(([path, text]) => !except.includes(path) && pattern.test(text))
    .map(([path]) => path);
}

/** The words a title keeps lowercase in its middle (UX §2). */
const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
]);

/**
 * Title Case as UX §2 writes it: every word starts with a capital except the small words, which
 * stay lowercase unless they come first, last or after a colon. Words with no letters ("&", "·")
 * pass, and so does a name with a capital inside ("iCloud").
 */
function isTitleCase(title: string): boolean {
  const words = title.split(/\s+/).filter(Boolean);
  return words.every((raw, index) => {
    const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const letter = /\p{L}/u.exec(word)?.[0];
    if (!letter) return true;
    const edge =
      index === 0 || index === words.length - 1 || (words[index - 1] ?? "").endsWith(":");
    if (!edge && SMALL_WORDS.has(word.toLowerCase())) return word === word.toLowerCase();
    return letter !== letter.toLowerCase() || /\p{Lu}/u.test(word);
  });
}

/** Every title the sources write as a literal: `title="…"` on a component, an h1 to h3's own
 * text, and the Settings pages' names (core's and each plugin's). */
function literalTitles(): string[] {
  const titles: string[] = [];
  for (const [path, text] of Object.entries(sources)) {
    const found = [
      ...text.matchAll(/<[A-Z]\w*[^>]*\stitle="([^"]+)"/g),
      ...text.matchAll(/<h[1-3]\b[^>]*>([^<{]+)</g),
      ...(path === "../features/settings/pages.ts" || /^\.\.\/features\/\w+\/index\.ts$/.test(path)
        ? text.matchAll(/\btitle: "([^"]+)"/g)
        : []),
    ];
    for (const match of found) titles.push((match[1] ?? "").trim());
  }
  return titles;
}

describe("design rules", () => {
  it("reads the sources as text", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(40);
    expect(offenders(/export function Button\(/)).toEqual(["../ui/Button.tsx"]);
  });

  it("paints with tokens only: no raw hex colors in components (UX §7)", () => {
    expect(offenders(/#[0-9a-fA-F]{3,8}\b(?![\w-])/, ["../lib/theme.ts"])).toEqual([]);
  });

  it("uses no title= tooltips on elements: they never appear on touch (PLAN §4)", () => {
    expect(offenders(/<[a-z][a-z0-9]*\b[^>]*\stitle=/)).toEqual([]);
  });

  it("injects no styles at runtime, so the strict CSP holds (ADR 0007)", () => {
    expect(
      offenders(
        /createElement\(\s*["']style["']|insertRule\(|adoptedStyleSheets|new CSSStyleSheet/,
      ),
    ).toEqual([]);
    expect(offenders(/dangerouslySetInnerHTML/)).toEqual([]);
  });

  it("never uses view transitions, which add styles without the nonce (ADR 0007)", () => {
    expect(offenders(/import[^;]*\b(AnimateView|animateView)\b|startViewTransition\(/)).toEqual([]);
  });

  it("keeps every motion component under MotionConfig with the nonce", () => {
    const users = offenders(/from "motion\/react"/);
    expect(users).toContain("../lib/motion.tsx");
    expect(offenders(/<MotionConfig/)).toEqual(["../lib/motion.tsx"]);
    for (const shell of ["../shell/DisplayShell.tsx", "../shell/PhoneShell.tsx"]) {
      expect(sources[shell], shell).toMatch(/<MotionProvider/);
    }
  });

  it("knows Title Case when it sees it (UX §2)", () => {
    for (const title of [
      "Who's Doing What",
      "Take Your Data with You",
      "Google: The Secret Address",
      "Calendars & Accounts",
      "Chores · This Week",
      "You’re Set",
      "Set a Parent PIN?",
      "Connect iCloud",
      "In This Version",
    ]) {
      expect(isTitleCase(title), title).toBe(true);
    }
    for (const title of [
      "Take your data with you",
      "Take Your Data With You",
      "Calendars & accounts",
      "Who lives here?",
    ]) {
      expect(isTitleCase(title), title).toBe(false);
    }
  });

  it("writes titles, headings and navigation in Title Case (UX §2, ADR 0028)", () => {
    const titles = literalTitles();
    expect(titles.length).toBeGreaterThan(60);
    expect(titles.filter((title) => !isTitleCase(title))).toEqual([]);
  });

  it("writes no all-caps labels (UX §1 What never appears)", () => {
    expect(
      offenders(/\buppercase\b/, [
        "../features/auth/SignInScreen.tsx",
        "../features/phone/PairDisplayScreen.tsx",
        "../features/onboarding/SetupWizard.tsx",
      ]),
    ).toEqual([]);
  });
});
