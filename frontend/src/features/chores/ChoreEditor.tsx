import { useState } from "react";

import { errorMessage } from "../../api/client";
import { zonedParts } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Segmented } from "../../ui/Segmented";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { Avatar } from "../../ui/Avatar";
import { firstDayOf } from "../calendar/EventEditor";
import { repeatPresets, repeatToRRule } from "../calendar/repeat";
import type { AddEditorProps } from "../registry";
import { useChoreChanges, useChoreSettings, type Chore, type ChoreIn } from "./data";
import { clockText } from "./words";

const TIMES = ["07:00", "08:00", "12:00", "15:00", "17:00", "19:00", "20:00"];
const STARS = [0, 1, 2, 3, 4, 5];

type Whose = { anyone: true } | { anyone: false; members: string[]; turns: boolean };

function whoseOf(chore: Chore): Whose {
  if (chore.assignee_mode === "any") return { anyone: true };
  return {
    anyone: false,
    members: chore.assignee_member_ids,
    turns: chore.assignee_mode === "rotate",
  };
}

/** Add → Chore (UX §4 "The Add panel for other things"). */
export function AddChore({ day, onDone }: AddEditorProps) {
  return <ChoreEditor onDone={onDone} startDay={day} />;
}

/**
 * A chore's fields (UX §4): what; whose (each person's own, taking turns, or anyone's); due by
 * a time or not; how it repeats; and its stars, when stars are on. Adding never asks for the
 * PIN; changing an existing chore does on the wall screen.
 */
export function ChoreEditor({
  chore,
  startDay = null,
  onDone,
}: {
  chore?: Chore;
  startDay?: string | null;
  onDone: () => void;
}) {
  const display = useShell() === "display";
  const today = zonedParts(useMinute()).day;
  const { data: members = [] } = useMembers();
  const { stars: starsOn } = useChoreSettings();
  const changes = useChoreChanges();
  const day = startDay ?? today;
  const presets = repeatPresets(day).filter((preset) =>
    ["none", "daily", "weekdays", "weekly", "biweekly", "monthly-date"].includes(preset.key),
  );
  const initialPreset = chore
    ? (presets.find(
        (preset) =>
          (preset.repeat ? repeatToRRule(preset.repeat, chore.start_date) : null) === chore.rrule,
      )?.key ?? (chore.rrule ? "keep" : "none"))
    : "daily";
  const [title, setTitle] = useState(chore?.title ?? "");
  const [whose, setWhose] = useState<Whose>(
    chore ? whoseOf(chore) : { anyone: false, members: [], turns: false },
  );
  const [time, setTime] = useState<string | null>(chore?.due_time ?? null);
  const [repeatKey, setRepeatKey] = useState(initialPreset);
  const [points, setPoints] = useState(chore?.points ?? 1);
  const preset = presets.find((p) => p.key === repeatKey);
  const ready = title.trim() !== "" && (whose.anyone || whose.members.length > 0);
  const gap = display ? "gap-6" : "gap-5";
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";

  const fields = (): ChoreIn => {
    const repeat = preset?.repeat ?? null;
    const first = firstDayOf(repeat, day);
    return {
      title: title.trim(),
      points: starsOn ? points : (chore?.points ?? 0),
      rrule: repeat ? repeatToRRule(repeat, first) : null,
      start_date: first,
      due_time: time,
      assignee_mode: whose.anyone
        ? "any"
        : whose.turns && whose.members.length > 1
          ? "rotate"
          : "fixed",
      assignee_member_ids: whose.anyone ? [] : whose.members,
      rotation_index: chore?.rotation_index ?? 0,
    };
  };

  const save = () => {
    if (!ready) return;
    if (!chore) {
      changes.addChore.mutate({ chore: fields() }, { onSuccess: onDone });
      return;
    }
    const next = fields();
    const repeatChanged = repeatKey !== initialPreset && repeatKey !== "keep";
    changes.changeChore.mutate(
      {
        chore,
        change: {
          title: next.title,
          ...(starsOn ? { points: next.points } : {}),
          ...(next.due_time ? { due_time: next.due_time } : { clear_due_time: true }),
          assignee_mode: next.assignee_mode,
          assignee_member_ids: next.assignee_member_ids ?? [],
          ...(repeatChanged
            ? next.rrule
              ? { rrule: next.rrule, start_date: next.start_date ?? day }
              : { clear_rrule: true, start_date: next.start_date ?? day }
            : {}),
        },
      },
      { onSuccess: onDone },
    );
  };

  const pending = changes.addChore.isPending || changes.changeChore.isPending;
  const error = changes.addChore.error ?? changes.changeChore.error;
  return (
    <form
      className={`flex flex-col ${gap}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <TextField
        label="What"
        autoComplete="off"
        autoFocus={!chore}
        placeholder="Feed the dog"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <div className="flex flex-col gap-2">
        <p className={heading}>Whose</p>
        <div
          role="group"
          aria-label="Whose"
          className={`flex flex-wrap ${display ? "gap-3" : "gap-2"}`}
        >
          <button
            type="button"
            aria-pressed={whose.anyone}
            data-person="everyone"
            onClick={() => {
              setWhose({ anyone: true });
            }}
            className={`press select-fill flex flex-col items-center gap-1 rounded-button p-2 aria-pressed:bg-p-tint aria-pressed:ring-[3px] aria-pressed:ring-ink ${
              display ? "min-w-24" : "min-w-16"
            }`}
          >
            <Avatar member={null} size={display ? "lg" : "md"} />
            <span
              className={
                display ? "text-d-secondary font-semibold" : "text-secondary font-semibold"
              }
            >
              Anyone
            </span>
          </button>
          {members.map((member) => {
            const on = !whose.anyone && whose.members.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={on}
                data-person={member.color}
                onClick={() => {
                  const current = whose.anyone ? [] : whose.members;
                  const next = on
                    ? current.filter((id) => id !== member.id)
                    : [...current, member.id];
                  setWhose({ anyone: false, members: next, turns: !whose.anyone && whose.turns });
                }}
                className={`press select-fill flex flex-col items-center gap-1 rounded-button p-2 aria-pressed:bg-p-tint aria-pressed:ring-[3px] aria-pressed:ring-ink ${
                  display ? "min-w-24" : "min-w-16"
                }`}
              >
                <Avatar member={member} size={display ? "lg" : "md"} />
                <span
                  className={
                    display ? "text-d-secondary font-semibold" : "text-secondary font-semibold"
                  }
                >
                  {member.name}
                </span>
              </button>
            );
          })}
        </div>
        {!whose.anyone && whose.members.length > 1 ? (
          <Segmented
            label="How they share it"
            value={whose.turns ? "turns" : "each"}
            options={[
              { value: "each", label: "Each does it" },
              { value: "turns", label: "They take turns" },
            ]}
            onChange={(value) => {
              setWhose({ ...whose, turns: value === "turns" });
            }}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Due</p>
        <ChipRow label="Due">
          <Chip
            on={time === null}
            onClick={() => {
              setTime(null);
            }}
          >
            Any time
          </Chip>
          {TIMES.map((hhmm) => (
            <Chip
              key={hhmm}
              on={time === hhmm}
              onClick={() => {
                setTime(hhmm);
              }}
            >
              {`by ${clockText(hhmm)}`}
            </Chip>
          ))}
          {time && !TIMES.includes(time) ? (
            <Chip on onClick={() => undefined}>{`by ${clockText(time)}`}</Chip>
          ) : null}
        </ChipRow>
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Repeats</p>
        <ChipRow label="Repeats">
          {initialPreset === "keep" ? (
            <Chip
              on={repeatKey === "keep"}
              onClick={() => {
                setRepeatKey("keep");
              }}
            >
              {chore?.repeat_text ?? "As it is"}
            </Chip>
          ) : null}
          {presets.map((option) => (
            <Chip
              key={option.key}
              on={repeatKey === option.key}
              onClick={() => {
                setRepeatKey(option.key);
              }}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
      </div>
      {starsOn ? (
        <div className="flex flex-col gap-2">
          <p className={heading}>Stars</p>
          <ChipRow label="Stars">
            {STARS.map((count) => (
              <Chip
                key={count}
                on={points === count}
                label={count === 1 ? "1 star" : `${String(count)} stars`}
                onClick={() => {
                  setPoints(count);
                }}
              >
                {count === 0 ? "None" : `★${String(count)}`}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" block disabled={!ready} pending={pending}>
        {chore ? "Save changes" : "Add chore"}
      </Button>
    </form>
  );
}
