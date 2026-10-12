import type { components } from "../api/schema";

export type PersonColor = components["schemas"]["MemberOut"]["color"];

/** The eight person colors, in their plain words (UX §10): what a picker shows and a screen
 * reader says. One list for every color picker in the app. */
export const COLORS: readonly { value: PersonColor; word: string }[] = [
  { value: "clay", word: "Red" },
  { value: "olive", word: "Olive" },
  { value: "moss", word: "Green" },
  { value: "sea", word: "Teal" },
  { value: "sky", word: "Blue" },
  { value: "iris", word: "Purple" },
  { value: "berry", word: "Plum" },
  { value: "rose", word: "Pink" },
];

/** "Red" for "clay"; the value itself if it's one we don't know. */
export function colorWord(color: string): string {
  return COLORS.find((candidate) => candidate.value === color)?.word ?? color;
}
