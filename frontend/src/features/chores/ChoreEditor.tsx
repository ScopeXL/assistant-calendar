import { useState } from "react";

import { errorMessage } from "../../api/client";
import { zonedParts } from "../../lib/dates";
import { useMembers, useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { DayField } from "../../ui/DayField";
import { Field, FormSection } from "../../ui/Field";
import { PanelActions } from "../../ui/PanelActions";
import { Segmented } from "../../ui/Segmented";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { TimeField } from "../../ui/TimeField";
import { WhoPicker } from "../../ui/WhoPicker";
import { firstDayOf, type KeptRule } from "../calendar/EventEditor";
import { RepeatField } from "../calendar/RepeatField";
import { repeatToRRule, rruleToRepeat, type Repeat, type RepeatEnd } from "../calendar/repeat";
import { useBoardDay } from "../calendar/useBoardDay";
import type { AddEditorProps } from "../registry";
import { useChoreChanges, useChoreSettings, type Chore, type ChoreIn } from "./data";
import { clockText } from "./words";

const STARS = [0, 1, 2, 3, 4, 5];
// A task repeats the simple ways; anything else is Custom.
const PRESETS = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly-date"];
const DAILY: Repeat = { freq: "daily", interval: 1 };

/** Add → Task (UX §4 "The Add panel for other things"). */
export function AddChore({ day, onDone }: AddEditorProps) {
  return <ChoreEditor onDone={onDone} startDay={day} />;
}

/**
 * A task's fields (UX §4, ADR 0029; stored as a chore): what; who does it (anyone, or the people
 * picked, each doing it or taking turns); the day it starts; due by a time or any time; how it
 * repeats, Custom included; and its stars, when stars are on. Each on its own row, the button
 * pinned above the keyboard. Adding never asks for the PIN; changing an existing task does on
 * the wall screen.
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
  const { data: settings } = useSettings();
  const weekStartsOn = settings?.week_starts_on ?? 6;
  const { stars: starsOn } = useChoreSettings();
  const changes = useChoreChanges();
  // An existing task's rule as one of the editor's shapes, or kept exactly as it is.
  const parsed = chore?.rrule ? rruleToRepeat(chore.rrule, chore.start_date, weekStartsOn) : null;
  const [title, setTitle] = useState(chore?.title ?? "");
  // No one picked is Anyone: whoever does it gets the credit.
  const [who, setWho] = useState<string[]>(
    chore && chore.assignee_mode !== "any" ? chore.assignee_member_ids : [],
  );
  const [turns, setTurns] = useState(chore?.assignee_mode === "rotate");
  const [day, setDay] = useState(chore?.start_date ?? startDay ?? today);
  const [time, setTime] = useState<string | null>(chore?.due_time ?? null);
  const [repeat, setRepeat] = useState<Repeat | null>(chore ? (parsed?.repeat ?? null) : DAILY);
  const [repeatEnd, setRepeatEnd] = useState<RepeatEnd>(parsed?.end ?? {});
  const [kept, setKept] = useState<KeptRule | null>(
    chore?.rrule && !parsed ? { rrule: chore.rrule, text: chore.repeat_text } : null,
  );
  // The rule and the day go back to the server only when one of them was changed here.
  const [whenTouched, setWhenTouched] = useState(false);
  const [points, setPoints] = useState(chore?.points ?? 1);
  // A day tapped on the board while Add is open is the day a new task starts.
  useBoardDay(startDay, (tapped) => {
    if (!chore) setDay(tapped);
  });
  const ready = title.trim() !== "";
  const gap = display ? "gap-8" : "gap-6";

  const fields = (): ChoreIn => {
    const first = firstDayOf(repeat, day);
    return {
      title: title.trim(),
      points: starsOn ? points : (chore?.points ?? 0),
      rrule: repeat ? repeatToRRule(repeat, first, repeatEnd, weekStartsOn) : (kept?.rrule ?? null),
      start_date: first,
      due_time: time,
      assignee_mode: who.length === 0 ? "any" : turns && who.length > 1 ? "rotate" : "fixed",
      assignee_member_ids: who,
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
    const ruleChanged = whenTouched && (next.rrule ?? null) !== (chore.rrule ?? null);
    const dayChanged = whenTouched && next.start_date !== chore.start_date;
    changes.changeChore.mutate(
      {
        chore,
        change: {
          title: next.title,
          ...(starsOn ? { points: next.points } : {}),
          ...(next.due_time ? { due_time: next.due_time } : { clear_due_time: true }),
          assignee_mode: next.assignee_mode,
          assignee_member_ids: next.assignee_member_ids ?? [],
          ...(ruleChanged ? (next.rrule ? { rrule: next.rrule } : { clear_rrule: true }) : {}),
          ...(ruleChanged || dayChanged ? { start_date: next.start_date ?? day } : {}),
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
      <FormSection title="What and Who" quiet>
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
        <Field label="Who">
          <WhoPicker
            label="Who"
            everyoneLabel="Anyone"
            members={members}
            value={who}
            multiple
            onChange={setWho}
          />
          {who.length > 1 ? (
            <Segmented
              label="How they share it"
              value={turns ? "turns" : "each"}
              options={[
                { value: "each", label: "Each does it" },
                { value: "turns", label: "They take turns" },
              ]}
              onChange={(value) => {
                setTurns(value === "turns");
              }}
            />
          ) : null}
        </Field>
      </FormSection>
      <FormSection title="When">
        <DayField
          value={day}
          today={today}
          weekStartsOn={weekStartsOn}
          hint={repeat || kept ? "The day it starts." : undefined}
          onChange={(next) => {
            setDay(next);
            setWhenTouched(true);
          }}
        />
        <TimeField
          label="Due"
          value={time}
          none={{ label: "Any time" }}
          words={(hhmm) => `by ${clockText(hhmm)}`}
          onChange={setTime}
        />
        <RepeatField
          day={day}
          today={today}
          value={repeat}
          repeatEnd={repeatEnd}
          kept={kept}
          weekStartsOn={weekStartsOn}
          presetKeys={PRESETS}
          onChange={(change) => {
            setRepeat(change.repeat);
            setRepeatEnd(change.repeatEnd);
            setKept(change.kept);
            setWhenTouched(true);
          }}
        />
      </FormSection>
      {starsOn ? (
        <FormSection title="Details">
          <Field label="Stars">
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
          </Field>
        </FormSection>
      ) : null}
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <PanelActions>
        <Button type="submit" block disabled={!ready} pending={pending}>
          {chore ? "Save Changes" : "Add Task"}
        </Button>
      </PanelActions>
    </form>
  );
}
