/**
 * Numbers that change in place (the clock, counts) without jiggling: Lexend has no tabular
 * figures, so each digit sits in a box as wide as the widest digit (ADR 0021). Screen readers
 * hear the plain text.
 */
export function Digits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true">
        {Array.from(value).map((char, index) =>
          /\d/.test(char) ? (
            <span key={index} className="digit">
              {char}
            </span>
          ) : (
            <span key={index}>{char}</span>
          ),
        )}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
