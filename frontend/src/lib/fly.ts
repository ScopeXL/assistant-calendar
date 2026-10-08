/**
 * "+2" flies to its person (UX §7 "Done"): it rises from the ticked box, then glides to the
 * person's avatar in the Today panel (or portrait's band), else to the one in their column's
 * header, settling as it lands (320 ms), and the avatar bumps (the `bump` class,
 * styles/motion.css). A fixed element moved with the Web Animations API, which the CSP allows.
 * With Reduce Motion nothing flies: the star count changing says it.
 */
import { reducedMotion } from "../ui/Celebration";

const START_MS = 200; // the box has filled (UX §7's table)
const RISE_MS = 250;
const SETTLE_MS = 320;
const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
const ARRIVE = "cubic-bezier(0.05, 0.7, 0.1, 1)";

interface Point {
  x: number;
  y: number;
}

function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

/** Where a person's points land: their avatar in the Today panel when it's on screen, else the
 * one in their column's header. Avatars that take points carry `data-points-to` (a member ID). */
export function landingFor(memberId: string): HTMLElement | null {
  const found = [
    ...document.querySelectorAll<HTMLElement>(`[data-points-to="${memberId}"]`),
  ].filter(onScreen);
  return found.find((element) => element.closest('[aria-label="Today"]')) ?? found[0] ?? null;
}

/** The point that puts something `size` big centered on `box`. */
function centered(box: DOMRect, size: DOMRect): Point {
  return {
    x: box.left + (box.width - size.width) / 2,
    y: box.top + (box.height - size.height) / 2,
  };
}

const at = ({ x, y }: Point, scale: number) =>
  `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`;

/** The avatar bumps as its points land; it replays if it bumped a moment ago. */
function bump(element: HTMLElement): void {
  element.classList.remove("bump");
  void element.getBoundingClientRect();
  element.classList.add("bump");
}

/**
 * Flies "+N" from the box to the person. Returns false when there's nowhere on screen to land,
 * so the row's own rise plays instead.
 */
export function flyPoints({
  from,
  memberId,
  points,
  display,
}: {
  from: Element | null;
  memberId: string;
  points: number;
  display: boolean;
}): boolean {
  const target = landingFor(memberId);
  if (!from || !target) return false;
  if (reducedMotion()) return true;
  const flier = document.createElement("span");
  flier.setAttribute("aria-hidden", "true");
  flier.className = `pointer-events-none fixed top-0 left-0 z-[55] font-bold text-sun-ink ${
    display ? "text-d-title" : "text-row"
  }`;
  flier.textContent = `+${String(points)}`;
  document.body.appendChild(flier);
  const size = flier.getBoundingClientRect();
  const start = centered(from.getBoundingClientRect(), size);
  const end = centered(target.getBoundingClientRect(), size);
  const flight = flier.animate(
    [
      { transform: at(start, 0.8), opacity: 0, easing: STANDARD },
      {
        transform: at({ x: start.x, y: start.y - size.height }, 1.1),
        opacity: 1,
        offset: RISE_MS / (RISE_MS + SETTLE_MS),
        easing: ARRIVE,
      },
      { transform: at(end, 0.7), opacity: 0.85 },
    ],
    { duration: RISE_MS + SETTLE_MS, delay: START_MS, fill: "both" },
  );
  flight.finished.then(
    () => {
      flier.remove();
      bump(target);
    },
    () => {
      flier.remove();
    },
  );
  return true;
}
