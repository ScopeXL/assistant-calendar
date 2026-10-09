import { Clock3, List } from "lucide-react";

import type { HoursZoom, WeekLayout } from "../../lib/displayState";
import { Segmented } from "../../ui/Segmented";
import { ZOOMS } from "./hours";

const LAYOUTS: { value: WeekLayout; label: string }[] = [
  { value: "agenda", label: "Agenda" },
  { value: "hours", label: "Hours" },
];

/**
 * The Week board's own controls (UX §3, ADR 0028), at the end of the header's second line: the
 * zoom while Hours is on, then the layout switch, kept last so it doesn't move under the finger
 * when the zoom appears. In a narrow header the switch shrinks to two icons. Both go back to the
 * household's after two minutes idle (lib/displayState).
 */
export function WeekTools({
  layout,
  zoom,
  onLayout,
  onZoom,
}: {
  layout: WeekLayout;
  zoom: HoursZoom;
  onLayout: (layout: WeekLayout) => void;
  onZoom: (zoom: HoursZoom) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {layout === "hours" ? (
        <Segmented
          label="Zoom"
          value={zoom}
          onChange={onZoom}
          options={ZOOMS.map((value) => ({ value, label: value }))}
        />
      ) : null}
      <div className="hidden @min-[56rem]:block">
        <Segmented label="Week layout" value={layout} onChange={onLayout} options={LAYOUTS} />
      </div>
      <div
        role="group"
        aria-label="Week layout"
        data-segmented=""
        className="flex gap-1 rounded-full border-2 border-line bg-surface p-1 @min-[56rem]:hidden"
      >
        {LAYOUTS.map(({ value, label }) => {
          const Icon = value === "agenda" ? List : Clock3;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={value === layout}
              onClick={() => {
                onLayout(value);
              }}
              className="press select-fill flex size-14 items-center justify-center rounded-full aria-pressed:bg-ink aria-pressed:text-on-ink"
            >
              <Icon aria-hidden="true" className="size-8" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
