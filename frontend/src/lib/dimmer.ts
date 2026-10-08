/**
 * Who dims the wall screen in the evening: the page itself (a dark veil, on any device), or the
 * Pi's screen helper, which sets the panel's own brightness (kiosk/sunroom-screen). The Pi's
 * launcher says which with `?dimmer=screen` or `?dimmer=page` on /display; it's remembered, so
 * a reload without it (the nightly update) keeps the choice. Anything else: the page.
 */
const KEY = "sunroom.dimmer";

export type Dimmer = "screen" | "page";

function remembered(): Dimmer {
  try {
    return window.localStorage.getItem(KEY) === "screen" ? "screen" : "page";
  } catch {
    return "page";
  }
}

/** Read `?dimmer=` once, when the app starts. */
export function noteDimmer(search: string): Dimmer {
  const asked = new URLSearchParams(search).get("dimmer");
  if (asked === "screen" || asked === "page") {
    try {
      window.localStorage.setItem(KEY, asked);
    } catch {
      // A screen that can't remember it dims the page itself next time: still readable.
    }
    return asked;
  }
  return remembered();
}
