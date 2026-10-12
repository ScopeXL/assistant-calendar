import { Clock3, List } from "lucide-react";

import type { HoursZoom, WeekLayout } from "../../lib/displayState";
import { IconSegmented, Segmented, type IconSegmentOption } from "../../ui/Segmented";
import { ZOOMS } from "./hours";

const LAYOUTS: IconSegmentOption<WeekLayout>[] = [
  { value: "agenda", label: "Agenda", icon: List },
  { value: "hours", label: "Hours", icon: Clock3 },
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
      <div className="@min-[56rem]:hidden">
        <IconSegmented label="Week layout" value={layout} onChange={onLayout} options={LAYOUTS} />
      </div>
    </div>
  );
}
