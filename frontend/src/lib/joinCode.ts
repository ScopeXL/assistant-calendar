/** Pair codes as people type them (backend: auth/join.py): one kind pairs a screen and adds a
 * phone (UX §11). */
export const CODE_LENGTH = 6;
// The alphabet has no look-alikes: no 0, O, 1, I or L.
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

/** Any case, spaces and dashes ignored; null when it can't be a code. */
export function normalizeCode(text: string): string | null {
  const code = text.replace(/[\s-]/g, "").toUpperCase();
  return CODE.test(code) ? code : null;
}

/** "7 K 4 M 9 X": how a screen reader should say it, a character at a time. */
export function spokenCode(code: string): string {
  return code.replace(/(.)(?=.)/g, "$1 ");
}

/** "7K4 M9X": two groups of three, easier to read out and type. */
export function displayCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** The code a QR link carries: `/join#7K4M9X` or `/pair#7K4M9X`. */
export function codeFromHash(hash: string): string | null {
  return normalizeCode(decodeURIComponent(hash.replace(/^#/, "")));
}
