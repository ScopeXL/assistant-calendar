import { useState } from "react";

import { errorMessage } from "../../api/client";
import { addDays, zonedParts } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { DayChooser } from "../../ui/DayChooser";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { WhoPicker } from "../../ui/WhoPicker";
import type { AddEditorProps } from "../registry";
import { COLORS } from "../settings/MemberSheet";
import { useCountdownChanges, type Countdown, type CountdownIn } from "./data";

const EMOJI = ["🎂", "🎉", "🏖️", "⛺", "✈️", "🎃", "🎄", "🏫", "⚽", "🎁"];

/** Add's Countdown (UX §4 "The Add panel for other things"). */
export function AddCountdown({ day, initialTitle, onDone }: AddEditorProps) {
  return <CountdownEditor onDone={onDone} startDay={day} startTitle={initialTitle ?? ""} />;
}

/**
 * A countdown's fields (UX §4): what it counts down to, the day, whose it is (or everyone's),
 * an emoji and a color if wanted, every year, and whether the kitchen screen shows it (off for
 * a surprise). Nothing asks for the PIN: countdowns are the family's.
 */
export function CountdownEditor({
  countdown,
  startDay = null,
  startTitle = "",
  onDone,
}: {
  countdown?: Countdown;
  startDay?: string | null;
  startTitle?: string;
  onDone: () => void;
}) {
  const display = useShell() === "display";
  const today = zonedParts(useMinute()).day;
  const { data: members = [] } = useMembers();
  const changes = useCountdownChanges();
  const [title, setTitle] = useState(countdown?.title ?? startTitle);
  const [day, setDay] = useState(
    countdown?.date ?? (startDay && startDay >= today ? startDay : addDays(today, 7)),
  );
  const [who, setWho] = useState<string[]>(countdown?.member_id ? [countdown.member_id] : []);
  const [emoji, setEmoji] = useState<string | null>(countdown?.emoji ?? null);
  const [color, setColor] = useState<NonNullable<CountdownIn["color"]> | null>(
    countdown?.color ?? null,
  );
  const [yearly, setYearly] = useState(countdown?.repeat_yearly ?? false);
  const [onWall, setOnWall] = useState(countdown?.show_on_display ?? true);
  const ready = title.trim() !== "" && (yearly || day >= today || countdown !== undefined);
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";

  const save = () => {
    if (!ready) return;
    const fields: CountdownIn = {
      title: title.trim(),
      date: day,
      emoji,
      color,
      time: countdown?.time ?? null,
      repeat_yearly: yearly,
      member_id: who[0] ?? null,
      show_on_display: onWall,
    };
    if (!countdown) {
      changes.add.mutate({ body: fields, member: who[0] ?? null }, { onSuccess: onDone });
      return;
    }
    changes.update.mutate(
      {
        id: countdown.id,
        patch: {
          title: fields.title,
          date: day,
          emoji: emoji ?? "",
          ...(color ? { color } : { clear_color: true }),
          repeat_yearly: yearly,
          ...(who[0] ? { member_id: who[0] } : { clear_member: true }),
          show_on_display: onWall,
        },
      },
      { onSuccess: onDone },
    );
  };

  const pending = changes.add.isPending || changes.update.isPending;
  const error = changes.add.error ?? changes.update.error;
  return (
    <form
      className={`flex flex-col ${display ? "gap-6" : "gap-5"}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <TextField
        label="What it counts down to"
        autoComplete="off"
        autoFocus={!countdown && !startTitle}
        placeholder="Beach trip"
        maxLength={80}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <DayChooser
        value={day}
        days={Array.from({ length: 8 }, (_, n) => addDays(today, n))}
        {...(yearly ? {} : { min: today })}
        onChange={setDay}
      />
      <div className="flex flex-col gap-2">
        <p className={heading}>Whose</p>
        <WhoPicker label="Whose" members={members} value={who} onChange={setWho} />
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Emoji</p>
        <ChipRow label="Emoji">
          <Chip
            on={emoji === null}
            onClick={() => {
              setEmoji(null);
            }}
          >
            None
          </Chip>
          {EMOJI.map((mark) => (
            <Chip
              key={mark}
              on={emoji === mark}
              onClick={() => {
                setEmoji(mark);
              }}
            >
              {mark}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Color</p>
        <ChipRow label="Color">
          <Chip
            on={color === null}
            onClick={() => {
              setColor(null);
            }}
          >
            {who.length ? "Their color" : "No color"}
          </Chip>
          {COLORS.map((option) => (
            <Chip
              key={option.value}
              on={color === option.value}
              onClick={() => {
                setColor(option.value);
              }}
            >
              <span className="inline-flex items-center gap-2" data-person={option.value}>
                <span aria-hidden="true" className="size-4 rounded-full bg-p" />
                {option.word}
              </span>
            </Chip>
          ))}
        </ChipRow>
      </div>
      <div className="flex flex-col divide-y divide-line">
        <Switch label="Every year" checked={yearly} onChange={setYearly} />
        <Switch
          label="Show it on the kitchen screen"
          hint="Off for a surprise: it shows on phones only."
          checked={onWall}
          onChange={setOnWall}
        />
      </div>
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" block disabled={!ready} pending={pending}>
        {countdown ? "Save changes" : "Add countdown"}
      </Button>
    </form>
  );
}
