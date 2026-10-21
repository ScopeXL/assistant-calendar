import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { SETTLE, useMotionReduced } from "../lib/motion";
import { createStore, useStore } from "../lib/store";
import { useShell } from "./shell";

/** How far a row slides to show its action: the button's 6rem. */
export const REVEAL = 96;
/** A drag shorter than this is still a tap. */
const TAP_SLOP = 8;
/** A flick this fast (px/s) decides on its own, whatever the distance. */
const FLICK = 300;

/** The one row that's open, so opening another closes it. */
const openRow = createStore<string | null>(null);

/**
 * Where a row let go at `x` (0 closed, -REVEAL open) comes to rest: open past half the button
 * or on a quick flick left, closed on a flick right or short of half.
 */
export function swipeSettles(x: number, velocity: number): boolean {
  if (velocity > FLICK) return false;
  return velocity < -FLICK || x < -REVEAL / 2;
}

/**
 * A row a phone can swipe to the left to show one action (ADR 0036, UX §1): **Remove**, a
 * shortcut for the sheet's own, never the only way. One row is open at a time; a tap anywhere
 * else closes it, and an open row's first tap only closes it. Hidden, the action is `inert`, so
 * a screen reader meets the sheet's Remove alone. On the wall it's only its children: the wall's
 * rows never swipe (its columns scroll sideways under a finger, and a wet finger shouldn't find a
 * Remove by accident).
 */
export function SwipeRow({
  action,
  label,
  onAction,
  disabled = false,
  children,
}: {
  /** The button's word ("Remove"). */
  action: string;
  /** Its spoken name ("Remove Eggs"). */
  label: string;
  onAction: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const phone = useShell() === "phone";
  if (!phone || disabled) return <>{children}</>;
  return (
    <Swipe action={action} label={label} onAction={onAction}>
      {children}
    </Swipe>
  );
}

function Swipe({
  action,
  label,
  onAction,
  children,
}: {
  action: string;
  label: string;
  onAction: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const open = useStore(openRow) === id;
  const reduced = useMotionReduced();
  const x = useMotionValue(0);
  const box = useRef<HTMLDivElement>(null);
  // How far the finger has gone since it went down: past TAP_SLOP it's a swipe, not a tap.
  const travel = useRef(0);
  const glide = reduced ? { duration: 0 } : SETTLE;

  const settle = (next: boolean) => {
    if (next) openRow.set(id);
    else if (openRow.get() === id) openRow.set(null);
    // Also when nothing changed: a row let go short of half slides back from where it was.
    animate(x, next ? -REVEAL : 0, glide);
  };

  // Closed from outside (another row opened, a tap elsewhere): slide back.
  useEffect(() => {
    if (open) return;
    const sliding = animate(x, 0, reduced ? { duration: 0 } : SETTLE);
    return () => {
      sliding.stop();
    };
  }, [open, reduced, x]);

  // While open, a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && box.current?.contains(event.target)) return;
      if (openRow.get() === id) openRow.set(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open, id]);

  // A row that leaves while open (it was removed) leaves nothing open behind it.
  useEffect(
    () => () => {
      if (openRow.get() === id) openRow.set(null);
    },
    [id],
  );

  return (
    <div ref={box} className="relative overflow-x-clip">
      <button
        type="button"
        aria-label={label}
        // Hidden three ways while the row is closed: no tab stop, no tap, nothing to hear.
        tabIndex={open ? 0 : -1}
        inert={!open}
        aria-hidden={open ? undefined : true}
        onClick={() => {
          settle(false);
          onAction();
        }}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-alert text-body font-bold text-on-alert"
      >
        {action}
      </button>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x }}
        onPointerDownCapture={() => {
          travel.current = 0;
        }}
        // A link or a picture in the row would start the browser's own drag instead.
        onDragStartCapture={(event) => {
          event.preventDefault();
        }}
        onDrag={(_event, info) => {
          travel.current = Math.max(travel.current, Math.abs(info.offset.x));
        }}
        onDragEnd={(_event, info) => {
          settle(travel.current < TAP_SLOP ? open : swipeSettles(x.get(), info.velocity.x));
        }}
        onClickCapture={(event) => {
          // A swipe isn't a tap, and an open row's first tap only closes it.
          if (travel.current < TAP_SLOP && !open) return;
          event.preventDefault();
          event.stopPropagation();
          if (travel.current < TAP_SLOP) settle(false);
        }}
        className="relative bg-surface"
      >
        {children}
      </motion.div>
    </div>
  );
}
