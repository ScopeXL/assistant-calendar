/**
 * The Sunroom mark (UX §7 "Icons and the app icon"): a window, with the sun's light filling its
 * lower-left pane. Keep the shapes in sync with scripts/build-icons.mjs.
 */
export function SunMark({ className, label = "Sunroom" }: { className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label={label}>
      <rect width="512" height="512" rx="112" className="fill-wall" />
      <rect x="112" y="256" width="144" height="144" className="fill-sun" />
      <g className="stroke-ink" fill="none" strokeWidth="28" strokeLinejoin="round">
        <rect x="112" y="112" width="288" height="288" rx="20" />
        <path d="M256 112v288M112 256h288" />
      </g>
    </svg>
  );
}
