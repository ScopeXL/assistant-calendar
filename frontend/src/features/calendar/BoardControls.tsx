import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock3, List } from "lucide-react";

import type { BoardView, WeekLayout } from "../../lib/displayState";
import type { Member } from "../../lib/household";
import { Button } from "../../ui/Button";
import { IconSegmented, type IconSegmentOption } from "../../ui/Segmented";
import { FilterButton } from "./FilterButton";
import { ViewSwitch, type SwitchableView } from "./ViewSwitch";

const LAYOUTS: IconSegmentOption<WeekLayout>[] = [
  { value: "agenda", label: "Agenda", icon: List },
  { value: "hours", label: "Hours", icon: Clock3 },
];

/**
 * The Calendar room's part of the wall's header (UX §3, ADR 0030). After today: the arrows
 * around "This Week" (or Today, This Month) and, on the Week view, its layout as two icons
 * (Agenda · Hours), beside the arrows because it changes the same board they page. At the
 * right: Filter (the people), then the view switch. No month and no span: the day heads carry
 * the dates, and the Month and Day views name themselves. People and Today don't filter, and
 * the Today view has no switch.
 */
export function BoardControls({
  view,
  onView,
  homeLabel,
  atHome,
  onPage,
  onHome,
  layout,
  onLayout,
  members,
  people,
  onPeople,
}: {
  view: BoardView;
  onView: (view: SwitchableView) => void;
  homeLabel: string;
  atHome: boolean;
  onPage: (step: -1 | 1) => void;
  onHome: () => void;
  layout: WeekLayout;
  onLayout: (layout: WeekLayout) => void;
  members: Member[];
  people: string[];
  onPeople: (people: string[]) => void;
}) {
  const span = view === "month" ? "month" : view === "day" ? "day" : "week";
  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          icon
          aria-label={`Previous ${span}`}
          onClick={() => {
            onPage(-1);
          }}
        >
          <ChevronLeft aria-hidden="true" className="size-8" />
        </Button>
        <Button variant="secondary" disabled={atHome} onClick={onHome}>
          {homeLabel}
        </Button>
        <Button
          variant="secondary"
          icon
          aria-label={`Next ${span}`}
          onClick={() => {
            onPage(1);
          }}
        >
          <ChevronRight aria-hidden="true" className="size-8" />
        </Button>
      </div>
      {view === "week" ? (
        <IconSegmented label="Week layout" value={layout} onChange={onLayout} options={LAYOUTS} />
      ) : null}
      <div className="ml-auto flex items-center gap-4">
        {view !== "people" && view !== "today" ? (
          <FilterButton members={members} people={people} onPeople={onPeople} />
        ) : null}
        {view !== "today" ? <ViewSwitch view={view} onView={onView} /> : null}
      </div>
    </>
  );
}

/**
 * The plugins' quiet pills above the board's days ("Google hasn't answered since 9:10 AM"),
 * all that is left of the board's own toolbar (ADR 0030). A pill decides for itself whether it
 * has anything to say, so the row takes no room until one does.
 */
export function BoardPills({ pills }: { pills: ReactNode[] }) {
  if (!pills.length) return null;
  return <div className="flex flex-wrap items-center gap-3 px-6 pt-3 empty:hidden">{pills}</div>;
}
