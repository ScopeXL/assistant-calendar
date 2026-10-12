import { SunMark } from "./SunMark";

const SIZES = {
  /** The setup wizard's top line on a phone: the mark beside the name. */
  line: { box: "flex items-center gap-3", mark: "size-10", word: "text-row" },
  /** Sign-in on a phone: the mark over the name. */
  stacked: { box: "flex flex-col items-center gap-4", mark: "size-24", word: "text-title" },
  /** The wall screen before it's paired. */
  entry: { box: "flex items-center gap-4", mark: "size-16", word: "text-d-title" },
  /** The top of the wall's rail: the mark over the name, beside Hide the rail. Folded, the
   * mark alone. */
  rail: { box: "flex flex-col items-start gap-1", mark: "size-10", word: "text-d-secondary" },
} as const;

/**
 * The Sunroom lockup (UX §7): the mark with the name beside or under it, in Lexend 800. With the
 * name written out the mark is decoration, so a screen reader hears "Sunroom" once; `markOnly`
 * leaves the mark to say it.
 */
export function Brand({
  size,
  markOnly = false,
  heading = false,
}: {
  size: keyof typeof SIZES;
  markOnly?: boolean;
  /** The name is the page's h1 (sign-in). */
  heading?: boolean;
}) {
  const { box, mark, word } = SIZES[size];
  if (markOnly) return <SunMark className={mark} />;
  const Word = heading ? "h1" : "p";
  return (
    <div className={box}>
      <SunMark className={mark} decorative />
      <Word className={`${word} font-extrabold`}>Sunroom</Word>
    </div>
  );
}
