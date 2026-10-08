import { Plus } from "lucide-react";
import { useState } from "react";

import { formatWallTime, shortDate } from "../../lib/dates";
import { useMembers, type Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { SidePanel } from "../../ui/SidePanel";
import { CountdownEditor } from "./CountdownEditor";
import { useCountdownChanges, useCountdowns, useUpcoming, type Upcoming } from "./data";
import { daysText, turningText } from "./words";

const EMPTY = "Count down to birthdays, trips, the last day of school.";

function whenText(item: Upcoming): string {
  const time = item.time ? ` · ${formatWallTime(`${item.date}T${item.time}`)}` : "";
  return `${shortDate(item.date)}${time}`;
}

/** One countdown's tile (UX §4 "Countdowns room"): the days at 72 px, the name, the day and
 * whose it is, in their color. */
function Tile({
  item,
  members,
  onOpen,
}: {
  item: Upcoming;
  members: Member[];
  onOpen: () => void;
}) {
  const display = useShell() === "display";
  const person = members.find((m) => m.id === item.member_id) ?? null;
  const color = item.color ?? person?.color ?? "everyone";
  const turning = person?.role === "kid" ? turningText(item.turning) : null;
  return (
    <button
      type="button"
      data-person={color}
      onClick={onOpen}
      className={`press flex w-full flex-col justify-between gap-3 rounded-panel border border-line text-left ${
        color !== "everyone" ? "border-l-[6px] border-l-p bg-p-tint" : "bg-surface"
      } ${display ? "min-h-[17.5rem] p-6" : "min-h-40 p-4"}`}
    >
      <span
        className={`${display ? "text-d-big" : "text-[2.5rem] leading-none"} font-extrabold text-p-text`}
      >
        {daysText(item.days)}
      </span>
      <span className="flex flex-col gap-1">
        <span className={`${display ? "text-d-title" : "text-row"} font-bold break-words`}>
          {item.emoji ? `${item.emoji} ` : ""}
          {item.title}
        </span>
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          {whenText(item)}
          {turning ? ` · ${turning}` : ""}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Avatar member={person} size={display ? "sm" : "xs"} />
        <span
          className={display ? "text-d-secondary font-semibold" : "text-secondary font-semibold"}
        >
          {person?.name ?? "Everyone"}
        </span>
      </span>
    </button>
  );
}

/** What a tapped tile opens: a countdown's Change and Remove, or where a birthday comes from. */
function Details({ item, onClose }: { item: Upcoming | null; onClose: () => void }) {
  const display = useShell() === "display";
  const { data: countdowns = [] } = useCountdowns();
  const changes = useCountdownChanges();
  const [changing, setChanging] = useState(false);
  const countdown = countdowns.find((c) => c.id === item?.countdown_id);
  const close = () => {
    setChanging(false);
    onClose();
  };
  const text = display ? "text-d-body" : "text-body";
  return (
    <SidePanel
      open={item !== null}
      title={changing ? "Change" : (item?.title ?? "")}
      onClose={close}
      footer={
        countdown && !changing ? (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setChanging(true);
              }}
            >
              Change
            </Button>
            <Button
              variant="quiet-danger"
              onClick={() => {
                changes.remove.mutate({ countdown }, { onSuccess: close });
              }}
            >
              Remove
            </Button>
          </div>
        ) : null
      }
    >
      {changing && countdown ? (
        <CountdownEditor countdown={countdown} onDone={close} />
      ) : item ? (
        <div className="flex flex-col gap-3">
          <p className={`${text} font-semibold`}>{`${daysText(item.days)} · ${whenText(item)}`}</p>
          {item.kind === "birthday" ? (
            <p className={`${text} text-ink-soft`}>
              Birthdays come from Family, in Settings. Change it there.
            </p>
          ) : null}
          {countdown?.repeat_yearly ? <p className={`${text} text-ink-soft`}>Every year</p> : null}
          {countdown && !countdown.show_on_display ? (
            <p className={`${text} text-ink-soft`}>Not on the kitchen screen: phones only.</p>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}

function Tiles({ onAdd }: { onAdd: () => void }) {
  const display = useShell() === "display";
  const { data, isSuccess } = useUpcoming();
  const { data: members = [] } = useMembers();
  const [open, setOpen] = useState<Upcoming | null>(null);
  const items = data?.items ?? [];
  return (
    <>
      {isSuccess && items.length === 0 ? (
        <EmptyState message={EMPTY} action={<Button onClick={onAdd}>Add countdown</Button>} />
      ) : (
        <ul
          aria-label="Countdowns"
          className={`grid gap-6 ${
            display
              ? "grid-cols-[repeat(auto-fill,minmax(25rem,1fr))]"
              : "grid-cols-1 gap-3 sm:grid-cols-2"
          }`}
        >
          {items.map((item) => (
            <li key={item.key}>
              <Tile
                item={item}
                members={members}
                onOpen={() => {
                  setOpen(item);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Details
        item={open}
        onClose={() => {
          setOpen(null);
        }}
      />
    </>
  );
}

/** The Countdowns room on the wall screen (UX §4): tiles, soonest first. */
export function CountdownsRoom() {
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="countdowns-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h1 id="countdowns-title" className="text-d-title font-bold">
          Countdowns
        </h1>
        <Button
          variant="secondary"
          onClick={() => {
            setAdding(true);
          }}
        >
          <Plus aria-hidden="true" className="size-7" />
          Add countdown
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6" tabIndex={0}>
        <Tiles
          onAdd={() => {
            setAdding(true);
          }}
        />
      </div>
      <SidePanel
        open={adding}
        title="Add countdown"
        onClose={() => {
          setAdding(false);
        }}
      >
        {adding ? (
          <CountdownEditor
            onDone={() => {
              setAdding(false);
            }}
          />
        ) : null}
      </SidePanel>
    </section>
  );
}

/** Countdowns on a phone (from More): the same tiles, and Add countdown. An event's "Add a
 * countdown" opens it at new/<day>/<title>, with those filled in. */
export function CountdownsTab({ path }: { path: string[] }) {
  const [verb, day, title] = path;
  const [adding, setAdding] = useState(verb === "new");
  return (
    <Screen
      title="Countdowns"
      back="/more"
      actions={
        <Button
          block
          onClick={() => {
            setAdding(true);
          }}
        >
          Add countdown
        </Button>
      }
    >
      <Tiles
        onAdd={() => {
          setAdding(true);
        }}
      />
      <Sheet
        open={adding}
        title="Add countdown"
        onClose={() => {
          setAdding(false);
        }}
      >
        {adding ? (
          <CountdownEditor
            startDay={verb === "new" && day ? day : null}
            startTitle={verb === "new" && title ? decodeURIComponent(title) : ""}
            onDone={() => {
              setAdding(false);
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
