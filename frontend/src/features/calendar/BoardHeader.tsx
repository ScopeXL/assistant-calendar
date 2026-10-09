import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";

import type { BoardView } from "../../lib/displayState";
import type { Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { LiveStatusButton } from "../../ui/LiveStatus";
import { Segmented } from "../../ui/Segmented";

const VIEWS: { value: Exclude<BoardView, "today">; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "people", label: "Who's Doing What" },
];

/**
 * The board's header on every view (UX §3): the title, the arrows and "This Week" (or Today,
 * This Month), the view switch, the person filter ("Show" and avatars, several at once), the
 * Today panel toggle and, in the top-right corner, the live-updates icon.
 */
export function BoardHeader({
  title,
  subtitle,
  view,
  onView,
  homeLabel,
  atHome,
  onPage,
  onHome,
  members,
  people,
  onPeople,
  panelShown,
  onTogglePanel,
  notice,
  pills,
  tools,
}: {
  title: string;
  subtitle?: string | undefined;
  view: BoardView;
  onView: (view: Exclude<BoardView, "today">) => void;
  homeLabel: string;
  atHome: boolean;
  onPage: (step: -1 | 1) => void;
  onHome: () => void;
  members: Member[];
  people: string[];
  onPeople: (people: string[]) => void;
  panelShown: boolean;
  onTogglePanel: () => void;
  /** Replaces the title for a moment ("Drop on a day"). */
  notice?: string | null;
  /** Quiet one-line states from plugins ("Google hasn't answered since 9:10 AM"). */
  pills?: ReactNode;
  /** The view's own controls, at the end of the second line (the Week's layout and zoom). */
  tools?: ReactNode;
}) {
  const toggle = (id: string) => {
    onPeople(people.includes(id) ? people.filter((p) => p !== id) : [...people, id]);
  };
  return (
    <header className="flex flex-col gap-3 px-6 pt-5 pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 aria-live="polite" className="text-d-title font-bold">
          {notice ?? (
            <>
              {title}{" "}
              {subtitle ? <span className="font-semibold text-ink-soft">{subtitle}</span> : null}
            </>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon
            aria-label={
              view === "month"
                ? "Previous month"
                : view === "day"
                  ? "Previous day"
                  : "Previous week"
            }
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
            aria-label={view === "month" ? "Next month" : view === "day" ? "Next day" : "Next week"}
            onClick={() => {
              onPage(1);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-8" />
          </Button>
        </div>
        {pills}
        <div className="ml-auto flex items-center gap-3">
          {view !== "today" ? (
            <div className="hidden @min-[70rem]:block">
              <Segmented label="View" value={view} onChange={onView} options={VIEWS} />
            </div>
          ) : null}
          <span className="portrait:hidden">
            <Button
              variant="secondary"
              icon
              aria-pressed={panelShown}
              onClick={onTogglePanel}
              aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
            >
              {panelShown ? (
                <PanelRightClose aria-hidden="true" className="size-8" />
              ) : (
                <PanelRightOpen aria-hidden="true" className="size-8" />
              )}
            </Button>
          </span>
          <LiveStatusButton />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {view !== "today" ? (
          <div className="@min-[70rem]:hidden">
            <Segmented label="View" value={view} onChange={onView} options={VIEWS} />
          </div>
        ) : null}
        {members.length > 1 ? (
          <div role="group" aria-label="Show" className="flex items-center gap-3">
            <span className="text-d-secondary font-semibold text-ink-soft">Show</span>
            {members.map((member) => {
              const on = people.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={member.name}
                  onClick={() => {
                    toggle(member.id);
                  }}
                  className={`press flex size-14 items-center justify-center rounded-full ${
                    on ? "ring-4 ring-ink" : people.length ? "opacity-50" : ""
                  }`}
                >
                  <Avatar member={member} size="md" />
                </button>
              );
            })}
            {people.length ? (
              <Button
                variant="quiet"
                onClick={() => {
                  onPeople([]);
                }}
              >
                Everyone
              </Button>
            ) : null}
          </div>
        ) : null}
        {tools ? <div className="ml-auto">{tools}</div> : null}
      </div>
    </header>
  );
}
