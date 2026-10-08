import { ArrowRight } from "lucide-react";

import { formatWallRange, formatWallTime, longMonthDay, longWeekday } from "../../lib/dates";
import type { Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { useShell } from "../../ui/shell";
import { isOn, isPast } from "./layout";
import type { Occurrence } from "./types";

/** "Soccer practice, 4:00 to 5:00 PM, Mia, Thursday October 9" (UX §10). */
export function occurrenceLabel(occurrence: Occurrence, people: Member[], day?: string): string {
  const when = occurrence.all_day
    ? "all day"
    : occurrence.start_local && occurrence.end_local
      ? formatWallRange(occurrence.start_local, occurrence.end_local).replace("–", " to ")
      : "";
  const who = people.length ? people.map((p) => p.name).join(", ") : "Everyone";
  const onDay = day ?? occurrence.start_date ?? occurrence.start_local?.slice(0, 10) ?? "";
  const date = onDay ? `${longWeekday(onDay)} ${longMonthDay(onDay)}` : "";
  return [occurrence.title, when, who, date].filter(Boolean).join(", ");
}

export function peopleOf(occurrence: Occurrence, members: Member[]): Member[] {
  return members.filter((member) => occurrence.member_ids.includes(member.id));
}

/**
 * An event on the board (UX §4 "Week board"). One person: a light tint of their color and a
 * 6 px bar at the left; several: a neutral tint with up to three avatars; Everyone: neutral. On
 * now: filled solid. Past (today): no tint, quiet text, when the household dims past events.
 */
export function EventChip({
  occurrence,
  members,
  now,
  dimPast,
  continues = false,
  compact = false,
  day,
  measuring = false,
  onOpen,
}: {
  occurrence: Occurrence;
  members: Member[];
  now: string;
  dimPast: boolean;
  continues?: boolean;
  /** Time and title on one row, the title on up to two lines (the all-day band, Who's doing
   * what). */
  compact?: boolean;
  day?: string;
  /** An invisible copy for measuring: not focusable. */
  measuring?: boolean;
  onOpen: () => void;
}) {
  const display = useShell() === "display";
  const people = peopleOf(occurrence, members);
  const one = people.length === 1 ? people[0] : undefined;
  const on = isOn(occurrence, now);
  const past = dimPast && !on && isPast(occurrence, now);
  const color = occurrence.color ?? one?.color ?? null;
  const tone = on
    ? "bg-p text-on-ink"
    : past
      ? "bg-transparent text-ink-soft"
      : color
        ? "bg-p-tint text-ink"
        : "bg-line/60 text-ink";
  const time =
    !occurrence.all_day && occurrence.start_local ? formatWallTime(occurrence.start_local) : null;
  return (
    <button
      type="button"
      data-person={on && !color ? "everyone" : (color ?? "everyone")}
      data-chip=""
      data-key={occurrence.key}
      aria-label={occurrenceLabel(occurrence, people, day)}
      tabIndex={measuring ? -1 : undefined}
      onClick={onOpen}
      className={`press relative flex w-full min-w-0 flex-col gap-0.5 overflow-hidden py-2 pr-2 text-left ${
        display ? "rounded-chip-d" : "rounded-chip"
      } ${color && !past ? "border-l-[6px] border-p pl-3" : "pl-3"} ${
        on && !color ? "bg-ink text-on-ink" : tone
      } ${compact ? `${display ? "min-h-14" : "min-h-11"} justify-center` : display ? "min-h-16" : "min-h-14"}`}
    >
      {compact || !time ? (
        <span className="flex min-w-0 items-center gap-2">
          {time ? (
            <span
              className={`${display ? "text-d-secondary" : "text-secondary"} font-semibold whitespace-nowrap`}
            >
              {time}
            </span>
          ) : null}
          <span
            className={`line-clamp-2 min-w-0 flex-1 break-words ${display ? "text-d-body" : "text-body"} font-semibold`}
          >
            {occurrence.title}
          </span>
          {continues ? <ArrowRight aria-hidden="true" className="size-6 shrink-0" /> : null}
          <PeopleMarks people={people} />
        </span>
      ) : (
        <>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`${display ? "text-d-secondary" : "text-secondary"} font-semibold whitespace-nowrap`}
            >
              {time}
            </span>
            <PeopleMarks people={people} />
          </span>
          <span
            className={`line-clamp-2 ${display ? "text-d-body" : "text-body"} font-semibold break-words`}
          >
            {occurrence.title}
            {continues ? " →" : ""}
          </span>
        </>
      )}
      {occurrence.is_override ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-sun-ink"
        />
      ) : null}
    </button>
  );
}

function PeopleMarks({ people }: { people: Member[] }) {
  if (people.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-2">
      {people.slice(0, 3).map((member) => (
        <Avatar key={member.id} member={member} size="xs" />
      ))}
    </span>
  );
}
