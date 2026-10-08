/**
 * Rasterizes the Sunroom mark (UX §7: a window, the sun's light in its lower-left pane) into the
 * icons the PWA manifest and iOS need. Keep the shapes in sync with src/ui/SunMark.tsx.
 * Run `pnpm icons` after changing the mark; the files are committed.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const WALL = "#f5f5f2";
const INK = "#1c2430";
const SUN = "#f5ae39";
const WINDOW = `
  <rect x="112" y="256" width="144" height="144" fill="${SUN}" />
  <g fill="none" stroke="${INK}" stroke-width="28" stroke-linejoin="round">
    <rect x="112" y="112" width="288" height="288" rx="20" />
    <path d="M256 112v288M112 256h288" />
  </g>`;

/** rounded: transparent corners (purpose "any"); scale < 1 keeps the window in the safe zone. */
function svg({ rounded, scale }) {
  const offset = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="${WALL}" />
  <g transform="translate(${offset} ${offset}) scale(${scale})">${WINDOW}</g>
</svg>`;
}

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
writeFileSync(`${publicDir}favicon.svg`, svg({ rounded: true, scale: 1 }) + "\n");

const targets = [
  { file: "icons/icon-192.png", size: 192, rounded: true, scale: 1 },
  { file: "icons/icon-512.png", size: 512, rounded: true, scale: 1 },
  { file: "icons/icon-maskable-512.png", size: 512, rounded: false, scale: 0.8 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, scale: 0.9 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const target of targets) {
  await page.setViewportSize({ width: target.size, height: target.size });
  const markup = svg(target).replace(
    'width="512" height="512"',
    `width="${target.size}" height="${target.size}"`,
  );
  await page.setContent(`<html><body style="margin:0">${markup}</body></html>`);
  await page.screenshot({ path: `${publicDir}${target.file}`, omitBackground: target.rounded });
  console.log(`wrote public/${target.file}`);
}
await browser.close();
