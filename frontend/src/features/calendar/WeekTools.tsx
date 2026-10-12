import { Clock3, List, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import type { WeekLayout } from "../../lib/displayState";
import { useStore } from "../../lib/store";
import { Button } from "../../ui/Button";
import { IconSegmented, Segmented, type IconSegmentOption } from "../../ui/Segmented";
import { zoomIn, zoomOut } from "./hours";
import { hoursMaxZoom } from "./hoursLimit";

const LAYOUTS: IconSegmentOption<WeekLayout>[] = [
  { value: "agenda", label: "Agenda", icon: List },
  { value: "hours", label: "Hours", icon: Clock3 },
];

/**
 * The Week board's own controls (UX §3, ADR 0029), at the right of the board's toolbar: the zoom
 * while Hours is on (Zoom out · Fit the day · Zoom in: each tap half again, as far as the grid
 * allows; Fit shows the whole day again), then the layout switch, kept last so it doesn't move
 * under the finger when the zoom appears. In a narrow board the switch shrinks to two icons.
 * Both go back to the household's after two minutes idle (lib/displayState).
 */
export function WeekTools({
  layout,
  zoom,
  onLayout,
  onZoom,
}: {
  layout: WeekLayout;
  /** 1 fits the whole day (features/calendar/hours). */
  zoom: number;
  onLayout: (layout: WeekLayout) => void;
  onZoom: (zoom: number) => void;
}) {
  const max = useStore(hoursMaxZoom);
  const fitted = zoom <= 1;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {layout === "hours" ? (
        // Three buttons, not a choice: one control to the tap-target check, like a segmented.
        <div role="group" aria-label="Zoom" data-segmented="" className="flex gap-2">
          <Button
            variant="secondary"
            icon
            aria-label="Zoom out"
            disabled={fitted}
            onClick={() => {
              onZoom(zoomOut(zoom));
            }}
          >
            <ZoomOut aria-hidden="true" className="size-8" />
          </Button>
          <Button
            variant="secondary"
            icon
            aria-label="Fit the day"
            disabled={fitted}
            onClick={() => {
              onZoom(1);
            }}
          >
            <Maximize2 aria-hidden="true" className="size-8" />
          </Button>
          <Button
            variant="secondary"
            icon
            aria-label="Zoom in"
            disabled={zoom >= max}
            onClick={() => {
              onZoom(zoomIn(zoom, max));
            }}
          >
            <ZoomIn aria-hidden="true" className="size-8" />
          </Button>
        </div>
      ) : null}
      <div className="hidden @min-[56rem]:block">
        <Segmented label="Week layout" value={layout} onChange={onLayout} options={LAYOUTS} />
      </div>
      <div className="@min-[56rem]:hidden">
        <IconSegmented label="Week layout" value={layout} onChange={onLayout} options={LAYOUTS} />
      </div>
    </div>
  );
}
