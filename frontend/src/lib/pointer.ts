/**
 * The wall hides the mouse pointer while nobody is moving it (ADR 0030): three seconds after the
 * mouse stops, and at once on a touch; a mouse move brings it back, as a video player does. The
 * page does it, so it works on every Pi (labwc's own rule needs 0.8.4, and shows the pointer for
 * good once the mouse has moved) and on the preview of /display in a laptop's browser.
 *
 * The mark goes on the page's root (`data-pointer="hidden"`, styles/tokens.css), not the shell:
 * the Add panel, the PIN pad and the keyboard are drawn beside the shell, not inside it. The
 * kiosk remounts its shell on a room switch, so a root remembers that it was hidden: the pointer
 * mustn't flash back each time a finger changes rooms.
 */
const hiddenRoots = new WeakSet<HTMLElement>();

export function watchPointer(
  root: HTMLElement = document.documentElement,
  idleMs = 3_000,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Chromium sends a pointermove of its own when the page changes under a resting pointer (the
  // clock ticks, a chip arrives): only a move to somewhere else is a hand on the mouse.
  let at: { x: number; y: number } | null = null;

  const hide = () => {
    clearTimeout(timer);
    hiddenRoots.add(root);
    root.dataset.pointer = "hidden";
  };
  const show = () => {
    hiddenRoots.delete(root);
    delete root.dataset.pointer;
    clearTimeout(timer);
    timer = setTimeout(hide, idleMs);
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (at?.x === event.screenX && at.y === event.screenY) return;
    at = { x: event.screenX, y: event.screenY };
    show();
  };
  const onDown = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") hide();
  };

  if (hiddenRoots.has(root)) hide();
  else show();
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerdown", onDown, true);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerdown", onDown, true);
    // The mark goes, the memory stays: the next watch on this root starts as this one ended.
    delete root.dataset.pointer;
  };
}
