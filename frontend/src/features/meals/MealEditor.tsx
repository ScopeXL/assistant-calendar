import { Search } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { addDays, weekOf, zonedParts } from "../../lib/dates";
import { useMembers, useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { DayChooser } from "../../ui/DayChooser";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { WhoPicker } from "../../ui/WhoPicker";
import type { AddEditorProps } from "../registry";
import {
  SLOT_WORDS,
  useAddToGroceries,
  useListsOn,
  useMealChanges,
  useSaved,
  useWeek,
  type Entry,
  type Saved,
  type Slot,
} from "./data";

/** Add's Meal (UX §4 "The Add panel for other things"). */
export function AddMeal({ day, initialTitle, onDone }: AddEditorProps) {
  return <MealEditor startDay={day} startText={initialTitle ?? ""} onDone={onDone} />;
}

const itemsText = (count: number) => (count === 1 ? "1 item" : `${String(count)} items`);

/**
 * A meal's fields (UX §4 "Meals room"): saved meals first, most made first, with a search; or a
 * new one typed in; the day, which meal (when the household plans more than dinner) and who
 * cooks. A saved meal with ingredients offers "Add 4 items to Groceries" while Lists is on.
 */
export function MealEditor({
  entry,
  startDay = null,
  startSlot = null,
  startText = "",
  onDone,
}: {
  entry?: Entry;
  startDay?: string | null;
  startSlot?: Slot | null;
  startText?: string;
  onDone: () => void;
}) {
  const display = useShell() === "display";
  const today = zonedParts(useMinute()).day;
  const { data: settings } = useSettings();
  const { data: members = [] } = useMembers();
  const anchor = entry?.day ?? startDay ?? today;
  const weekStart = weekOf(anchor, settings?.week_starts_on ?? 6)[0] ?? anchor;
  const { data: week } = useWeek(weekStart);
  const slots = week?.slots ?? ["dinner"];
  const changes = useMealChanges();
  const groceries = useAddToGroceries();
  const listsOn = useListsOn();
  const [search, setSearch] = useState("");
  const { data: saved = [] } = useSaved(search);
  const [text, setText] = useState(entry?.text ?? startText);
  const [picked, setPicked] = useState<Saved | null>(null);
  const [day, setDay] = useState(entry?.day ?? startDay ?? today);
  const [slot, setSlot] = useState<Slot>(entry?.slot ?? startSlot ?? "dinner");
  const [cook, setCook] = useState<string[]>(entry?.member_id ? [entry.member_id] : []);
  const [shop, setShop] = useState(true);
  const ingredients = picked?.ingredients ?? [];
  const ready = text.trim() !== "";
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";

  const pick = (meal: Saved) => {
    setPicked(meal);
    setText(meal.text);
  };

  const save = () => {
    if (!ready) return;
    const sameAsPicked = picked !== null && picked.text === text.trim();
    changes.save.mutate(
      {
        body: {
          ...(entry ? { id: entry.id } : {}),
          day,
          slot,
          position: entry?.position ?? 0,
          text: text.trim(),
          emoji: sameAsPicked ? picked.emoji : (entry?.emoji ?? null),
          recipe_url: sameAsPicked ? picked.recipe_url : (entry?.recipe_url ?? null),
          note: entry?.note ?? null,
          member_id: cook[0] ?? null,
          saved_meal_id: sameAsPicked ? picked.id : null,
        },
        member: cook[0] ?? null,
        before: entry ?? null,
      },
      {
        onSuccess: () => {
          if (sameAsPicked && shop && listsOn && ingredients.length) {
            groceries.mutate({ items: ingredients, member: cook[0] ?? null });
          }
          onDone();
        },
      },
    );
  };

  const verb = entry ? "Save changes" : `Add ${SLOT_WORDS[slot].toLowerCase()}`;
  return (
    <form
      className={`flex flex-col ${display ? "gap-6" : "gap-5"}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {!entry ? (
        <div className="flex flex-col gap-3">
          <p className={heading}>Saved Meals</p>
          <TextField
            label="Find a saved meal"
            hideLabel
            placeholder="Find a saved meal"
            autoComplete="off"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          {saved.length ? (
            <ChipRow label="Saved meals">
              {saved.slice(0, 12).map((meal) => (
                <Chip
                  key={meal.id}
                  on={picked?.id === meal.id}
                  onClick={() => {
                    pick(meal);
                  }}
                >
                  {meal.emoji ? `${meal.emoji} ${meal.text}` : meal.text}
                </Chip>
              ))}
            </ChipRow>
          ) : (
            <p
              className={
                display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
              }
            >
              <Search aria-hidden="true" className="mr-2 inline size-5" />
              {search.trim()
                ? "No saved meal by that name. Type it below."
                : "Meals you add are kept here for next time."}
            </p>
          )}
        </div>
      ) : null}
      <TextField
        label={entry ? "What" : "Or type a new meal"}
        autoComplete="off"
        placeholder="Tacos"
        maxLength={120}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <DayChooser
        value={day}
        days={Array.from({ length: 7 }, (_, n) => addDays(weekStart, n))}
        onChange={setDay}
      />
      {slots.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className={heading}>Which meal</p>
          <ChipRow label="Which meal">
            {slots.map((option) => (
              <Chip
                key={option}
                on={slot === option}
                onClick={() => {
                  setSlot(option);
                }}
              >
                {SLOT_WORDS[option]}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className={heading}>Who cooks</p>
        <WhoPicker label="Who cooks" members={members} value={cook} onChange={setCook} />
      </div>
      {picked?.text === text.trim() && ingredients.length > 0 && listsOn && !entry ? (
        <Switch
          label={`Add ${itemsText(ingredients.length)} to Groceries`}
          hint={ingredients.join(", ")}
          checked={shop}
          onChange={setShop}
        />
      ) : null}
      {changes.save.error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(changes.save.error)}
        </p>
      ) : null}
      <Button type="submit" block disabled={!ready} pending={changes.save.isPending}>
        {verb}
      </Button>
    </form>
  );
}
