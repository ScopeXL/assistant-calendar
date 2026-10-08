import { useMemo } from "react";
import { encode } from "uqr";

const QUIET_ZONE = 4; // modules of white around the code, as the QR standard asks

/**
 * A QR code drawn as one SVG path (no canvas, no injected styles). Dark modules on a white tile
 * in both themes, because not every camera reads a light-on-dark code.
 */
export function QrCode({
  value,
  label,
  className = "size-60",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 0 });
    let d = "";
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${String(x + QUIET_ZONE)} ${String(y + QUIET_ZONE)}h1v1h-1z`;
      });
    });
    return { size: qr.size + QUIET_ZONE * 2, path: d };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={`${className} max-w-full rounded-chip border border-line bg-qr-tile`}
    >
      <path d={path} className="fill-qr-ink" />
    </svg>
  );
}
