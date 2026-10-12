import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { BoardView } from "../../lib/displayState";
import type { Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { ViewSwitch, type SwitchableView } from "./ViewSwitch";

/**
 * The Calendar room's part of the wall's header (UX §3, ADR 0029): the arrows around "This Week"
 * (or Today, This Month), then the view switch at the right. The Today view has no switch.
 */
export function BoardControls({
  view,
  onView,
  homeLabel,
  atHome,
  onPage,
  onHome,
}: {
  view: BoardView;
  onView: (view: SwitchableView) => void;
  homeLabel: string;
  atHome: boolean;
  onPage: (step: -1 | 1) => void;
  onHome: () => void;
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
      {view !== "today" ? (
        <div className="ml-auto">
          <ViewSwitch view={view} onView={onView} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The board's own toolbar, above its days (UX §3): the person filter ("Show" and avatars,
 * several at once), the plugins' quiet pills ("Google hasn't answered since 9:10 AM"), and at
 * the right the view's own tools (the Week's zoom and layout). Nothing at all when there's one
 * person, no pill and no tool.
 */
export function BoardToolbar({
  members,
  people,
  onPeople,
  pills,
  tools,
}: {
  members: Member[];
  people: string[];
  onPeople: (people: string[]) => void;
  pills?: ReactNode[];
  tools?: ReactNode;
}) {
  const toggle = (id: string) => {
    onPeople(people.includes(id) ? people.filter((p) => p !== id) : [...people, id]);
  };
  const show = members.length > 1;
  if (!show && !pills?.length && !tools) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 pt-4 pb-3">
      {show ? (
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
                className={`press flex size-tap items-center justify-center rounded-full ${
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
      {pills}
      {tools ? <div className="ml-auto">{tools}</div> : null}
    </div>
  );
}
