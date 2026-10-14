import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, Plus } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { HeaderBack } from "../../shell/HeaderLinks";
import { RoomHeader } from "../../shell/roomHeader";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { EmptyState } from "../../ui/EmptyState";
import { Field } from "../../ui/Field";
import { PanelActions } from "../../ui/PanelActions";
import { ScrollRow } from "../../ui/ScrollRow";
import { useShell } from "../../ui/shell";
import { SidePanel } from "../../ui/SidePanel";
import { TextField } from "../../ui/TextField";
import { useMealChanges, useSaved, type Saved } from "./data";

// What a saved meal can wear: picked from a row, since the wall's keyboard has no emoji.
const EMOJI = ["🌮", "🍕", "🍝", "🍗", "🐟", "🥗", "🍲", "🍔", "🥪", "🍳", "🥘", "🍜"];

const madeText = (count: number) =>
  count === 0 ? "Not made yet" : count === 1 ? "Made once" : `Made ${String(count)} times`;

/**
 * Saved meals (UX §4 "Meals room"): the library, most made first: each with its name, "made 6
 * times" and a recipe link; New saved meal; change one, or Archive it (Recently removed keeps
 * it 7 days).
 */
export function SavedMeals() {
  const display = useShell() === "display";
  const { data: saved = [], isSuccess } = useSaved();
  const [editing, setEditing] = useState<Saved | "new" | null>(null);
  const body = (
    <>
      {isSuccess && saved.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No saved meals yet"
          note="Save a meal once and add it in one tap next week."
          action={
            // A phone's bottom bar already has New Saved Meal.
            display ? (
              <Button
                onClick={() => {
                  setEditing("new");
                }}
              >
                New Saved Meal
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className={
            display
              ? "grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4"
              : "flex flex-col gap-2"
          }
        >
          {saved.map((meal) => (
            <li key={meal.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(meal);
                }}
                className={`press flex w-full flex-col gap-1 rounded-panel border border-line bg-surface text-left ${
                  display ? "min-h-32 p-5" : "min-h-16 p-4"
                }`}
              >
                <span className={`${display ? "text-d-title" : "text-row"} font-bold break-words`}>
                  {meal.emoji ? `${meal.emoji} ` : ""}
                  {meal.text}
                </span>
                <span
                  className={
                    display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                  }
                >
                  {madeText(meal.use_count)}
                  {meal.ingredients.length
                    ? ` · ${meal.ingredients.length === 1 ? "1 ingredient" : `${String(meal.ingredients.length)} ingredients`}`
                    : ""}
                  {meal.recipe_url ? " · a recipe" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <SavedPanel
        meal={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
      />
    </>
  );
  const add = (
    <Button
      variant="secondary"
      className={display ? "ml-auto" : ""}
      onClick={() => {
        setEditing("new");
      }}
    >
      <Plus aria-hidden="true" className={display ? "size-7" : "size-5"} />
      New Saved Meal
    </Button>
  );
  if (display) {
    // The wall: the title, the way back and New saved meal are in the header.
    return (
      <section aria-label="Saved Meals" className="flex min-h-0 flex-1 flex-col">
        <RoomHeader
          title="Saved Meals"
          visibleTitle
          back={
            <HeaderBack to="/$room" params={{ room: "meals" }}>
              Meals
            </HeaderBack>
          }
          controls={add}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-6" tabIndex={0}>
          {body}
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/$room"
            params={{ room: "meals" }}
            aria-label="Back to Meals"
            className="press inline-flex size-11 items-center justify-center rounded-button border-2 border-line bg-surface"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
          <h1 id="saved-title" className="text-title font-bold">
            Saved Meals
          </h1>
        </div>
        {add}
      </header>
      {body}
    </section>
  );
}

/** A saved meal's name, emoji, recipe link and ingredients (one per line), and Archive. */
function SavedPanel({
  meal,
  open,
  onClose,
}: {
  meal: Saved | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <SidePanel open={open} title={meal ? meal.text : "New Saved Meal"} onClose={onClose}>
      {open ? <SavedForm key={meal?.id ?? "new"} meal={meal} onDone={onClose} /> : null}
    </SidePanel>
  );
}

function SavedForm({ meal, onDone }: { meal: Saved | null; onDone: () => void }) {
  const display = useShell() === "display";
  const changes = useMealChanges();
  const [text, setText] = useState(meal?.text ?? "");
  const [emoji, setEmoji] = useState(meal?.emoji ?? "");
  const [recipe, setRecipe] = useState(meal?.recipe_url ?? "");
  const [ingredients, setIngredients] = useState((meal?.ingredients ?? []).join(", "));
  const list = ingredients
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const pending = changes.addSaved.isPending || changes.changeSaved.isPending;
  const error = changes.addSaved.error ?? changes.changeSaved.error;
  return (
    <form
      className={`flex flex-col ${display ? "gap-6" : "gap-5"}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        if (meal) {
          changes.changeSaved.mutate(
            {
              id: meal.id,
              patch: {
                text: text.trim(),
                emoji: emoji.trim(),
                recipe_url: recipe.trim(),
                ingredients: list,
              },
            },
            { onSuccess: onDone },
          );
        } else {
          changes.addSaved.mutate(
            {
              body: {
                text: text.trim(),
                emoji: emoji.trim() || null,
                recipe_url: recipe.trim() || null,
                ingredients: list,
              },
            },
            { onSuccess: onDone },
          );
        }
      }}
    >
      <TextField
        label="Name"
        autoComplete="off"
        maxLength={120}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {/* A row to pick from, as a countdown's: the wall's keyboard has no emoji to type. */}
      <Field label="Emoji">
        <ScrollRow label="Emoji">
          <Chip
            on={emoji === ""}
            onClick={() => {
              setEmoji("");
            }}
          >
            None
          </Chip>
          {[...new Set([...(emoji ? [emoji] : []), ...EMOJI])].map((mark) => (
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
        </ScrollRow>
      </Field>
      <TextField
        label="Recipe link (optional)"
        autoComplete="off"
        maxLength={500}
        value={recipe}
        onChange={(event) => {
          setRecipe(event.target.value);
        }}
      />
      <TextField
        label="Ingredients, with commas"
        hint="They go on Groceries in one tap."
        autoComplete="off"
        value={ingredients}
        onChange={(event) => {
          setIngredients(event.target.value);
        }}
      />
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      {meal ? (
        <Button
          variant="quiet-danger"
          block
          onClick={() => {
            changes.archiveSaved.mutate({ saved: meal }, { onSuccess: onDone });
          }}
        >
          Archive
        </Button>
      ) : null}
      <PanelActions>
        <Button type="submit" block disabled={!text.trim()} pending={pending}>
          {meal ? "Save Changes" : "Save Meal"}
        </Button>
      </PanelActions>
    </form>
  );
}
