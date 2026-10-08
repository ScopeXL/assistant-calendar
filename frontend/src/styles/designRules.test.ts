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
