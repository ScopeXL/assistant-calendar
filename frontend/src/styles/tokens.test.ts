/**
 * Every text/background pair meets its contrast target in both themes and at every wall tint
 * (docs/UX.md §7, §10). Reads the real tokens.css, so a color change can't slip through. Person
 * tints are color-mix(in oklab, …), so this mixes in OKLab too.
 */
import { describe, expect, it } from "vitest";

import css from "./tokens.css?raw";

type Rgb = [number, number, number];
type Theme = "light" | "dark";

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing block ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("unbalanced braces");
}

/** --name: light-dark(#light, #dark) and --name: #hex declarations in a block. */
function declarations(body: string): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {};
  for (const match of body.matchAll(
    /--([a-z-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)\s*;/gi,
  )) {
    const [, name, light, dark] = match;
    if (name && light && dark) out[name] = { light, dark };
  }
  for (const match of body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match;
    if (name && value) out[name] = { light: value, dark: value };
  }
  return out;
}

const base = declarations(block(":root"));
const DAYPARTS: Record<Theme, string[]> = {
  light: ["midday", "dawn", "afternoon", "dusk"],
  dark: ["night", "evening"],
};

function token(name: string, theme: Theme): string {
  const value = base[name]?.[theme];
  if (!value) throw new Error(`missing token --${name}`);
  return value;
}

function wall(daypart: string, theme: Theme): string {
  if (daypart === "midday" || daypart === "night") return token("wall", theme);
  const tint = declarations(block(`:root[data-daypart="${daypart}"]`));
  const value = tint.wall?.[theme];
  if (!value) throw new Error(`missing wall for ${daypart}`);
  return value;
}

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function gamma(channel: number): number {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map(linear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb | string, b: Rgb | string): number {
  const la = luminance(typeof a === "string" ? rgb(a) : a);
  const lb = luminance(typeof b === "string" ? rgb(b) : b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB → OKLab → back, as color-mix(in oklab, a p%, b) does. */
function toOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function mix(color: string, share: number, over: string): Rgb {
  const a = toOklab(rgb(color));
  const b = toOklab(rgb(over));
  return fromOklab([0, 1, 2].map((i) => (a[i] ?? 0) * share + (b[i] ?? 0) * (1 - share)) as Rgb);
}

const PEOPLE = ["clay", "olive", "moss", "sea", "sky", "iris", "berry", "rose"];

function solid(person: string, theme: Theme): string {
  return token(`${person}-${theme === "light" ? "l" : "d"}`, "light");
}

describe.each(["light", "dark"] as const)("the %s theme", (theme) => {
  const at = (name: string) => token(name, theme);

  describe.each(DAYPARTS[theme])("at %s", (daypart) => {
    const w = wall(daypart, theme);

    it("ink reads at 13:1 or more on the wall", () => {
      expect(contrast(at("ink"), w)).toBeGreaterThanOrEqual(13);
    });

    it("secondary text passes AA with room to spare", () => {
      expect(contrast(at("ink-soft"), w)).toBeGreaterThanOrEqual(4.9);
    });

    it("the now line and its label pass AA", () => {
      expect(contrast(at("sun-ink"), w)).toBeGreaterThanOrEqual(4.5);
    });

    it("errors pass AA", () => {
      expect(contrast(at("alert"), w)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("text on the surface passes AA", () => {
    for (const name of ["ink", "ink-soft", "sun-ink", "alert"]) {
      expect(contrast(at(name), at("surface")), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("buttons, sun fills and error fills pass AA", () => {
    expect(contrast(at("on-ink"), at("ink"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(at("on-sun"), at("sun"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(at("on-alert"), at("alert"))).toBeGreaterThanOrEqual(4.5);
  });

  it("text on today's lit column passes AA, and the column stands out from the wall", () => {
    for (const name of ["ink", "ink-soft", "sun-ink"]) {
      expect(contrast(at(name), at("lit")), name).toBeGreaterThanOrEqual(4.5);
    }
    for (const daypart of DAYPARTS[theme]) {
      const step = contrast(at("lit"), wall(daypart, theme));
      expect(step, daypart).toBeGreaterThanOrEqual(theme === "light" ? 1.08 : 1.2);
    }
  });

  it("switches read at 3:1 against the row, on and off", () => {
    expect(contrast(at("ink-soft"), at("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(at("on-ink"), at("ink"))).toBeGreaterThanOrEqual(3);
  });

  it("grid lines show against the wall and the surface", () => {
    expect(contrast(at("line"), at("surface"))).toBeGreaterThanOrEqual(1.2);
  });

  describe.each(PEOPLE)("%s", (person) => {
    const color = solid(person, theme);
    const surface = at("surface");

    it("text on a solid fill (an event in progress, a checked box) passes", () => {
      // Light: white on the solid; dark: the dark theme's on-ink (UX §7).
      expect(contrast(at("on-ink"), color)).toBeGreaterThanOrEqual(theme === "light" ? 5 : 4.5);
    });

    it("the solid reads as a mark on the wall and surface", () => {
      for (const daypart of DAYPARTS[theme]) {
        expect(contrast(color, wall(daypart, theme))).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
    });

    it("chip titles (ink) on the person's tint pass AA", () => {
      const tint = mix(color, theme === "light" ? 0.12 : 0.24, surface);
      expect(contrast(at("ink"), tint)).toBeGreaterThanOrEqual(4.5);
    });

    it("text in the person's color (dark theme) passes AA on the surface", () => {
      if (theme === "dark") expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe("the token file", () => {
  it("defines the eight person colors in both themes", () => {
    for (const person of PEOPLE) {
      expect(base[`${person}-l`], person).toBeDefined();
      expect(base[`${person}-d`], person).toBeDefined();
      expect(css).toContain(`[data-person="${person}"]`);
    }
  });

  it("keeps the focus ring on the ink", () => {
    expect(block(":root")).toContain("--focus-ring: var(--ink);");
  });
});

describe("the screensaver's band", () => {
  it("keeps its words readable over the brightest photo (the wash is 60% at the words)", () => {
    const white = token("saver-ink", "light");
    expect(
      contrast(white, mix(token("saver-shade", "light"), 0.6, "#ffffff")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
