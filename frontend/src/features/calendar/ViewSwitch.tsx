import { Calendar1, CalendarDays, CalendarRange, ChevronDown, Users } from "lucide-react";

import type { BoardView } from "../../lib/displayState";
import { Button } from "../../ui/Button";
import { Menu, MenuRadio } from "../../ui/Menu";
import { IconSegmented, type IconSegmentOption } from "../../ui/Segmented";

export type SwitchableView = Exclude<BoardView, "today">;

export const VIEWS: readonly IconSegmentOption<SwitchableView>[] = [
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "day", label: "Day", icon: Calendar1 },
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "people", label: "People", icon: Users },
];

/**
 * The board's views in the wall's header (UX §3, ADR 0029): four icons with the chosen one's
 * word beside it while the header has room (64rem of its own width), a **View** button with a
 * menu when it doesn't. Either way the current view is written out. Only one form is drawn at a
 * time (the header's container decides), so a button named "Day" is never there twice.
 */
export function ViewSwitch({
  view,
  onView,
}: {
  view: SwitchableView;
  onView: (view: SwitchableView) => void;
}) {
  return (
    <>
      <div className="hidden @min-[64rem]/header:block">
        <IconSegmented label="View" options={VIEWS} value={view} onChange={onView} showChosen />
      </div>
      <div className="@min-[64rem]/header:hidden">
        <ViewMenu view={view} onView={onView} />
      </div>
    </>
  );
}

/** The narrow form: "View: Week" opens the four views as a menu of radio items (ui/Menu). */
function ViewMenu({
  view,
  onView,
}: {
  view: SwitchableView;
  onView: (view: SwitchableView) => void;
}) {
  const current = VIEWS.find((option) => option.value === view) ?? VIEWS[0];
  const CurrentIcon = current?.icon ?? CalendarRange;
  return (
    <Menu
      label="View"
      trigger={(props) => (
        <Button {...props} variant="secondary" aria-label={`View: ${current?.label ?? ""}`}>
          <CurrentIcon aria-hidden="true" className="size-8" />
          {current?.label}
          <ChevronDown aria-hidden="true" className="size-7 text-ink-soft" />
        </Button>
      )}
    >
      {VIEWS.map(({ value, label, icon }) => (
        <MenuRadio
          key={value}
          icon={icon}
          checked={value === view}
          onChoose={() => {
            onView(value);
          }}
        >
          {label}
        </MenuRadio>
      ))}
    </Menu>
  );
}
