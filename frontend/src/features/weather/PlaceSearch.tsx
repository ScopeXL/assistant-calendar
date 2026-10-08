import { MapPin } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { useSettings } from "../../lib/household";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { Group, Text } from "../settings/parts";
import { usePlaces, useSetPlace, type Place } from "./data";

/** Find the household's town by name and pick it (Open-Meteo's place search). */
function PlaceSearch({ onPicked }: { onPicked: (place: Place) => void }) {
  const display = useShell() === "display";
  const [words, setWords] = useState("");
  const [query, setQuery] = useState("");
  const { data: places, isFetching, error } = usePlaces(query);
  const setPlace = useSetPlace();
  const text = display ? "text-d-body" : "text-body";
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(words.trim());
        }}
      >
        <div className="min-w-56 flex-1">
          <TextField
            label="Your town"
            value={words}
            maxLength={80}
            autoComplete="address-level2"
            onChange={(event) => {
              setWords(event.target.value);
            }}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          pending={isFetching}
          disabled={words.trim().length < 2}
        >
          Search
        </Button>
      </form>
      {error ? (
        <p role="alert" className={`${text} font-semibold text-alert`}>
          {errorMessage(error)}
        </p>
      ) : places?.length === 0 ? (
        <p className={`${text} text-ink-soft`}>Nothing by that name. Try the nearest town.</p>
      ) : places ? (
        <ul aria-label="Places" className="flex flex-col gap-2">
          {places.map((place) => (
            <li key={`${String(place.latitude)},${String(place.longitude)}`}>
              <button
                type="button"
                onClick={() => {
                  setPlace.mutate(place, {
                    onSuccess: () => {
                      onPicked(place);
                    },
                  });
                }}
                className={`press-row flex w-full items-center gap-3 rounded-chip border border-line bg-surface px-4 text-left ${
                  display ? "min-h-16 text-d-body" : "min-h-12 text-body"
                } font-semibold`}
              >
                <MapPin aria-hidden="true" className="size-6 shrink-0 text-ink-soft" />
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {setPlace.isError ? (
        <p role="alert" className={`${text} font-semibold text-alert`}>
          {errorMessage(setPlace.error)}
        </p>
      ) : null}
    </div>
  );
}

/** First run's "Where's home?" (PLAN §15 M4): for the weather and the sunset. */
export function PlaceOnboarding({ onDone }: { onDone: () => void }) {
  return (
    <>
      <p className="text-body">
        Sunroom shows your weather and turns dark at sunset. Type your town, or a town nearby.
      </p>
      <PlaceSearch onPicked={onDone} />
      <Button variant="quiet" block onClick={onDone}>
        Later
      </Button>
    </>
  );
}

/** Settings → Household → Location (UX §4): the town, Change and Remove. */
export function LocationSettings() {
  const display = useShell() === "display";
  const { data: settings } = useSettings();
  const setPlace = useSetPlace();
  const [changing, setChanging] = useState(false);
  const label = settings?.location_label ?? null;
  return (
    <Group
      title="Location"
      note="For the weather and the sunset. The town you search for and where it is go to Open-Meteo; nothing else does."
    >
      <div className={`flex flex-col gap-4 ${display ? "py-5" : "py-4"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text soft={!label}>{label ?? "Not set yet. Until it is, it gets dark at 7 PM."}</Text>
          <div className="flex gap-3">
            {!changing ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setChanging(true);
                }}
              >
                {label ? "Change" : "Set the town"}
              </Button>
            ) : null}
            {label && !changing ? (
              <Button
                variant="quiet-danger"
                pending={setPlace.isPending}
                onClick={() => {
                  setPlace.mutate(null);
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        {changing ? (
          <PlaceSearch
            onPicked={() => {
              setChanging(false);
            }}
          />
        ) : null}
      </div>
    </Group>
  );
}
