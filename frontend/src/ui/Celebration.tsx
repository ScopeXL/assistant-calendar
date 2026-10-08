/**
 * The celebration layer (UX §7 "Done", §9; ADR 0007): bursts of small discs and four-point stars
 * in a person's color and `sun`, drawn on one canvas above the app, rising and falling with
 * gravity, then fading. It's the one thing in Sunroom that bursts: a chore or item done ("row"),
 * someone's last chore of the day ("big"), the end of a routine or a reward said yes to ("full").
 *
 * With Reduce Motion (the device's setting, or the display's) nothing bursts: the box filling,
 * the check and "Done by Mia" already say it's done. A canvas draws without inline styles, so the
 * CSP's style nonce has nothing to do here.
 */
import { useEffect, useRef } from "react";

import { createStore } from "../lib/store";

export type BurstSize = "row" | "big" | "full";

export interface Particle {
  x: number;
  y: number;
  vx: number; // px per ms
  vy: number;
  size: number;
  spin: number; // radians per ms
  angle: number;
  star: boolean;
  color: string;
  life: number; // ms
}

interface Burst {
  started: number;
  particles: Particle[];
}

const GRAVITY = 0.0016; // px per ms²
const SHAPES: Record<BurstSize, { count: number; speed: number; life: number }> = {
  row: { count: 28, speed: 0.55, life: 600 },
  big: { count: 48, speed: 0.75, life: 900 },
  full: { count: 140, speed: 0.95, life: 900 },
};

const bursts = createStore<Burst[]>([]);

export function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return (
    document.documentElement.hasAttribute("data-reduce-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A token's color, as the browser resolved it for this theme (no raw hex in code). */
function resolved(className: string, person?: string): string {
  const probe = document.createElement("span");
  probe.className = className;
  if (person) probe.dataset.person = person;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

/** The particles of one burst from (x, y); `random` is injectable for tests. */
export function makeParticles(
  size: BurstSize,
  x: number,
  y: number,
  colors: string[],
  width: number,
  random: () => number = Math.random,
): Particle[] {
  const shape = SHAPES[size];
  return Array.from({ length: shape.count }, (_, index) => {
    // A row's burst rises in a fan; the full-screen one starts across the whole width.
    const fromX = size === "full" ? random() * width : x;
    const angle = -Math.PI / 2 + (random() - 0.5) * (size === "row" ? 1.6 : 2.4);
    const speed = shape.speed * (0.55 + random() * 0.6);
    return {
      x: fromX,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + random() * 6,
      spin: (random() - 0.5) * 0.02,
      angle: random() * Math.PI,
      star: index % 3 === 0,
      color: colors[index % colors.length] ?? colors[0] ?? "currentColor",
      life: shape.life * (0.8 + random() * 0.4),
    };
  });
}

/**
 * Burst from the middle of `from`, in `person`'s color (their color name, or "everyone") and
 * sun. Does nothing with Reduce Motion on.
 */
export function celebrate(from: Element | null, person: string, size: BurstSize = "row"): void {
  if (!from || reducedMotion()) return;
  const box = from.getBoundingClientRect();
  const colors = [resolved("bg-p", person), resolved("bg-sun")];
  const y = size === "full" ? window.innerHeight * 0.7 : box.top + box.height / 2;
  const particles = makeParticles(size, box.left + box.width / 2, y, colors, window.innerWidth);
  bursts.set((list) => [...list, { started: performance.now(), particles }]);
}

function drawStar(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  for (let point = 0; point < 8; point++) {
    const radius = point % 2 === 0 ? size : size * 0.38;
    const angle = (point * Math.PI) / 4;
    context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  context.closePath();
  context.fill();
}

/** The canvas, once per shell; it only draws while a burst is alive. */
export function CelebrationLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      const node = canvas.current;
      const context = node?.getContext("2d");
      if (!node || !context) return;
      const ratio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
        node.width = Math.round(width * ratio);
        node.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const alive = bursts
        .get()
        .filter((burst) => burst.particles.some((particle) => now - burst.started < particle.life));
      for (const burst of alive) {
        const t = now - burst.started;
        for (const particle of burst.particles) {
          if (t >= particle.life) continue;
          const x = particle.x + particle.vx * t;
          const y = particle.y + particle.vy * t + (GRAVITY * t * t) / 2;
          context.save();
          context.globalAlpha = Math.max(0, 1 - t / particle.life) ** 1.5;
          context.fillStyle = particle.color;
          context.translate(x, y);
          context.rotate(particle.angle + particle.spin * t);
          if (particle.star) drawStar(context, particle.size);
          else {
            context.beginPath();
            context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        }
      }
      if (alive.length !== bursts.get().length) bursts.set(alive);
      frame = alive.length ? requestAnimationFrame(draw) : 0;
    };
    const start = () => {
      if (!frame && bursts.get().length) frame = requestAnimationFrame(draw);
    };
    const stop = bursts.subscribe(start);
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[55] size-full print:hidden"
    />
  );
}
