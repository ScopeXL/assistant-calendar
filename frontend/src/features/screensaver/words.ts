/**
 * What a photo library says (UX §4 "Photo Libraries", ADR 0036): the sentence under What to Show,
 * which says plainly what the screensaver shows, and the line under a library's name.
 */
import { formatTime } from "../../lib/dates";

interface Choice {
  id: string;
  name: string;
}

interface Picks {
  people: readonly string[];
  albums: readonly string[];
  tags: readonly string[];
}

interface Choices {
  people: readonly Choice[];
  albums: readonly Choice[];
  tags: readonly Choice[];
}

/** "1,000" */
export function count(value: number): string {
  return value.toLocaleString("en-US");
}

/** "1 photo", "12,345 photos". */
export function photosWord(value: number): string {
  return value === 1 ? "1 photo" : `${count(value)} photos`;
}

/** "Mia", "Mia or Leo", "Mia, Leo or Sam". */
function orList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1) ?? ""}`;
}

/** The picks' names from the choices; an id the library no longer has is "one that's gone". */
function named(ids: readonly string[], from: readonly Choice[]): string {
  const names = ids.flatMap((id) => from.find((choice) => choice.id === id)?.name ?? []);
  const gone = ids.length - names.length;
  if (gone) names.push(gone === 1 ? "one that's gone" : `${count(gone)} that are gone`);
  return orList(names);
}

/**
 * What the screensaver shows from a library, in a sentence: "Showing every photo, newest first,
 * up to 500. Pick people, albums or tags to narrow it." or "Showing photos of Mia or Leo, or in
 * Beach 2026, or tagged Wall, newest first, up to 500." (any pick matches).
 */
export function picksSentence(picks: Picks, choices: Choices | undefined, limit: number): string {
  const upTo = `newest first, up to ${count(limit)}`;
  if (!picks.people.length && !picks.albums.length && !picks.tags.length) {
    return `Showing every photo, ${upTo}. Pick people, albums or tags to narrow it.`;
  }
  const parts: string[] = [];
  if (picks.people.length) parts.push(`of ${named(picks.people, choices?.people ?? [])}`);
  if (picks.albums.length) parts.push(`in ${named(picks.albums, choices?.albums ?? [])}`);
  if (picks.tags.length) parts.push(`tagged ${named(picks.tags, choices?.tags ?? [])}`);
  return `Showing photos ${parts.join(", or ")}, ${upTo}.`;
}

interface LibraryState {
  status: string;
  checking: boolean;
  pending: number;
  photo_count: number;
  last_scan_at: string | null;
  last_error: string | null;
}

/**
 * The line under a library's name: how it's doing. ``trouble`` when it's a problem a parent can
 * fix (drawn in red): "Needs its key again", the server's silence, a full disk.
 */
export function libraryLine(library: LibraryState): { text: string; trouble: boolean } {
  if (library.status === "needs_reconnect") return { text: "Needs its key again", trouble: true };
  if (library.status === "error") {
    return { text: library.last_error ?? "Hasn't answered", trouble: true };
  }
  if (library.pending > 0) {
    const total = library.photo_count + library.pending;
    return {
      text: `Bringing in photos… ${count(library.photo_count)} of ${count(total)}`,
      trouble: false,
    };
  }
  if (library.checking) return { text: "Checking…", trouble: false };
  if (library.last_error) return { text: library.last_error, trouble: true };
  if (!library.last_scan_at) return { text: "Not checked yet", trouble: false };
  return {
    text: `Checked ${formatTime(new Date(library.last_scan_at))} · ${photosWord(library.photo_count)}`,
    trouble: false,
  };
}

/** "Connected · Immich 2.7 · 12,345 photos" (the count when the server said). */
export function connectedLine(
  library: { version: string | null; library_photos: number | null },
  kindName: string,
): string {
  const version = library.version ? ` ${library.version.split(".").slice(0, 2).join(".")}` : "";
  const photos = library.library_photos !== null ? ` · ${photosWord(library.library_photos)}` : "";
  return `Connected · ${kindName}${version}${photos}`;
}
