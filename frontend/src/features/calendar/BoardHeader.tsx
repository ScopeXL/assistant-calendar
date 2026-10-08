import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";

import type { BoardView } from "../../lib/displayState";
import type { Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";

const VIEWS: { value: Exclude<BoardView, "today">; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "people", label: "Who's doing what" },
];

/**
 * The board's header on every view (UX §3): the title, the arrows and "This week" (or Today,
 * This month), the view switch, the person filter ("Show" and avatars, several at once) and
 * the Today panel toggle.
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
}) {
  const panelIcon = panelShown ? (
    <PanelRightClose aria-hidden="true" className="size-7" />
  ) : (
    <PanelRightOpen aria-hidden="true" className="size-7" />
  );
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
        <div className="ml-auto flex items-center gap-3">
          {view !== "today" ? (
            <div className="hidden @min-[70rem]:block">
              <Segmented label="View" value={view} onChange={onView} options={VIEWS} />
            </div>
          ) : null}
          <span className="hidden @min-[60rem]:block portrait:hidden">
            <Button
              variant="quiet"
              aria-pressed={panelShown}
              onClick={onTogglePanel}
              aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
            >
              {panelIcon}
              Today panel
            </Button>
          </span>
          <span className="block @min-[60rem]:hidden portrait:hidden">
            <Button
              variant="quiet"
              icon
              aria-pressed={panelShown}
              onClick={onTogglePanel}
              aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
            >
              {panelIcon}
            </Button>
          </span>
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
      </div>
    </header>
  );
}
