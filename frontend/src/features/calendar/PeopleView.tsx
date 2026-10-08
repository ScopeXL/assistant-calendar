import type { Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { usePersonColumns } from "../usePluginModules";
import { EventChip } from "./EventChip";
import { byDay } from "./layout";
import type { Occurrence } from "./types";

const COLUMNS = 7;

/**
 * Who's doing what (UX §4): a column per person, Everyone first, in household order, with the
 * avatar and name glance-sized so a kid finds their own column; today's events underneath, then
 * what the plugins add (their chores, with working boxes). Seven columns fit; more page
 * sideways.
 */
export function PeopleView({
  today,
  now,
  occurrences,
  members,
  dimPast,
  onOpen,
}: {
  today: string;
  now: string;
  occurrences: Occurrence[];
  members: Member[];
  dimPast: boolean;
  onOpen: (occurrence: Occurrence) => void;
}) {
  const extras = usePersonColumns();
  const column = byDay(occurrences, [today]).get(today);
  const todays = [...(column?.allDay ?? []), ...(column?.timed ?? [])].map((e) => e.occurrence);
  const columns: { key: string; member: Member | null; items: Occurrence[] }[] = [
    { key: "everyone", member: null, items: todays.filter((o) => o.member_ids.length === 0) },
    ...members.map((member) => ({
      key: member.id,
      member,
      items: todays.filter((o) => o.member_ids.includes(member.id)),
    })),
  ];
  return (
    <div className="flex min-h-0 flex-1 snap-x overflow-x-auto border-t border-line">
      {columns.map(({ key, member, items }) => (
        <section
          key={key}
          aria-label={member ? member.name : "Everyone"}
          className="flex min-h-0 shrink-0 snap-start flex-col gap-3 overflow-y-auto border-r border-line px-3 py-4"
          style={{ width: `${String(100 / Math.min(columns.length, COLUMNS))}%` }}
        >
          <header className="flex flex-col items-center gap-2 pb-2">
            <Avatar member={member} size="xl" />
            <h2 className="text-d-title font-bold">{member ? member.name : "Everyone"}</h2>
          </header>
          {items.length ? (
            items.map((occurrence) => (
              <EventChip
                key={occurrence.key}
                occurrence={occurrence}
                members={members}
                now={now}
                dimPast={dimPast}
                compact
                day={today}
                onOpen={() => {
                  onOpen(occurrence);
                }}
              />
            ))
          ) : (
            <p className="px-2 text-center text-d-secondary text-ink-soft">Nothing on</p>
          )}
          {extras.map((Extra, index) => (
            <Extra key={index} memberId={member?.id ?? null} day={today} />
          ))}
        </section>
      ))}
    </div>
  );
}
