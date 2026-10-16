import type { components } from "../api/schema";

export type PersonColor = components["schemas"]["MemberOut"]["color"];

/** The twelve person colors, in their plain words (UX §10): what a picker shows and a screen
 * reader says. One list for every color picker in the app; the last four came in 0.12.0, after
 * the first eight, so nobody's color moved (ADR 0034). */
export const COLORS: readonly { value: PersonColor; word: string }[] = [
  { value: "clay", word: "Red" },
  { value: "olive", word: "Olive" },
  { value: "moss", word: "Green" },
  { value: "sea", word: "Teal" },
  { value: "sky", word: "Blue" },
  { value: "iris", word: "Purple" },
  { value: "berry", word: "Plum" },
  { value: "rose", word: "Pink" },
  { value: "copper", word: "Orange" },
  { value: "bark", word: "Brown" },
  { value: "slate", word: "Gray" },
  { value: "lime", word: "Lime" },
];

/** "Red" for "clay"; the value itself if it's one we don't know. */
export function colorWord(color: string): string {
  return COLORS.find((candidate) => candidate.value === color)?.word ?? color;
}
