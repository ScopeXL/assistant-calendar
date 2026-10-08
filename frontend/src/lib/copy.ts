/**
 * Copy text from a tap. navigator.clipboard exists only in a secure context (https, or
 * localhost), and Sunroom is often reached over plain http at home, where it's missing. Then a
 * hidden <textarea> is selected and copied with execCommand("copy"), which still works there.
 * Resolves false when nothing worked, so the caller can say so instead of claiming it copied.
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (navigator as Partial<Navigator>).clipboard;
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return copyWithTextarea(text);
}

/** The old way: select the text in a textarea off screen, copy it, take the textarea away. */
function copyWithTextarea(text: string): boolean {
  const before = document.activeElement;
  const area = document.createElement("textarea");
  area.value = text;
  // Read-only, so a phone doesn't raise its keyboard; 16 px, so an iPhone doesn't zoom in.
  // Placed with classes only: the CSP forbids inline styles.
  area.readOnly = true;
  area.tabIndex = -1;
  area.setAttribute("aria-hidden", "true");
  area.className = "fixed top-0 -left-[9999px] text-body";
  // Inside the open sheet, if there is one (the newest, if several): a modal <dialog> makes the
  // rest of the page inert, and nothing there can be selected.
  const sheet =
    before?.closest("dialog[open]") ?? [...document.querySelectorAll("dialog[open]")].at(-1);
  (sheet ?? document.body).append(area);
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length); // iOS selects nothing with select() alone
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only copy over plain http
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
  }
}
