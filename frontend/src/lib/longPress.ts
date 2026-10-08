/**
 * A long press as a shortcut (UX §1: every action has a visible button; a hold is a shortcut to
 * one). A finger or the mouse held still on the element for half a second calls `onHold`, and the
 * click its release makes is swallowed, so a tile that opens on a tap doesn't open as well.
 * Moving more than a few pixels lets it be a scroll instead; a held finger never opens the
 * browser's own menu.
 */
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

export const HOLD_MS = 500;
const SLOP_PX = 10;

export function useLongPress(onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const held = useRef(onHold);
  useEffect(() => {
    held.current = onHold;
  });
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        start.current = null;
        fired.current = true;
        held.current();
      }, HOLD_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      const from = start.current;
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
    },
  };
}
