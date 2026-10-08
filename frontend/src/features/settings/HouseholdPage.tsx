import { useState } from "react";

import { errorMessage } from "../../api/client";
import type { components } from "../../api/schema";
import { useSettings, useUpdateSettings } from "../../lib/household";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { usePluginModules } from "../usePluginModules";
import { Group, Row } from "./parts";
import { RecentlyRemoved } from "./RecentlyRemoved";

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

type Settings = components["schemas"]["SettingsOut"];

/** Settings → Household (UX §4): name, time zone, the week's first day, the clock, and what was
 * recently removed. */
export function HouseholdPage() {
  const { data: settings } = useSettings();
  // The form starts from the saved values, so it waits for them.
  return settings ? <HouseholdForm settings={settings} /> : null;
}

function HouseholdForm({ settings }: { settings: Settings }) {
  const display = useShell() === "display";
  const update = useUpdateSettings();
  // What plugins add to this page (the weather: Location).
  const sections = usePluginModules().flatMap((module) =>
    module.settings?.household ? [module.settings.household] : [],
  );
  const [name, setName] = useState(settings.household_name);
  const [zone, setZone] = useState(settings.timezone);
  const allZones = zones();
  return (
    <>
      <Group title="Household">
        <form
          className={`flex flex-wrap items-end gap-4 ${display ? "py-5" : "py-4"}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) update.mutate({ household_name: name.trim() });
          }}
        >
          <div className="min-w-64 flex-1">
            <TextField
              label="Name"
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!name.trim() || name.trim() === settings.household_name}
          >
            Save name
          </Button>
        </form>
        <form
          className={`flex flex-wrap items-end gap-4 ${display ? "py-5" : "py-4"}`}
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ timezone: zone });
          }}
        >
          <label className="flex min-w-64 flex-1 flex-col gap-2">
            <span className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>
              Time zone
            </span>
            <Select
              value={zone}
              onChange={(event) => {
                setZone(event.target.value);
              }}
            >
              {(allZones.includes(zone) ? allZones : [zone, ...allZones]).map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" disabled={!zone || zone === settings.timezone}>
            Save time zone
          </Button>
        </form>
        <Row label="Week starts on">
          <Segmented
            label="Week starts on"
            value={String(settings.week_starts_on) as "6" | "0"}
            onChange={(value) => {
              update.mutate({ week_starts_on: Number(value) });
            }}
            options={[
              { value: "6", label: "Sunday" },
              { value: "0", label: "Monday" },
            ]}
          />
        </Row>
        <Row label="Time">
          <Segmented
            label="Time format"
            value={settings.time_format}
            onChange={(time_format) => {
              update.mutate({ time_format });
            }}
            options={[
              { value: "12h", label: "12-hour" },
              { value: "24h", label: "24-hour" },
            ]}
          />
        </Row>
      </Group>
      {sections.map((Section, index) => (
        <Section key={index} />
      ))}
      <RecentlyRemoved />
      {update.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(update.error)}
        </p>
      ) : null}
    </>
  );
}
