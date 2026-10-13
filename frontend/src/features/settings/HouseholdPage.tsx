import { useState } from "react";

import type { components } from "../../api/schema";
import { useSettings, useUpdateSettings } from "../../lib/household";
import { useSavedFlash } from "../../lib/savedFlash";
import { SavedMark } from "../../ui/SavedMark";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { usePluginModules } from "../usePluginModules";
import { Group, Row } from "./parts";

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
  // The name is typed, so it keeps a draft while it has focus and saves when it's left or on
  // ↵; the time zone is a pick, so it saves as it changes. Neither has a button (ADR 0029).
  const [name, setName] = useState<string | null>(null);
  const nameSaved = useSavedFlash();
  const zoneSaved = useSavedFlash();
  const allZones = zones();
  const zone = settings.timezone;
  const saveName = () => {
    const typed = name?.trim() ?? "";
    // Unchanged, or emptied: nothing to save, and the saved name comes back.
    if (name === null || typed === "" || typed === settings.household_name) {
      setName(null);
      return;
    }
    update.mutate(
      { household_name: typed },
      {
        onSuccess: () => {
          setName(null);
          nameSaved.flash();
        },
      },
    );
  };
  return (
    <>
      <Group title="Household">
        <div className={`flex flex-col gap-1 ${display ? "py-5" : "py-4"}`}>
          <TextField
            strong
            label="Name"
            value={name ?? settings.household_name}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
            }}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveName();
              }
            }}
          />
          <SavedMark show={nameSaved.saved} />
        </div>
        <div className={`flex flex-col gap-1 ${display ? "py-5" : "py-4"}`}>
          <label className="flex flex-col gap-2">
            <span className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>
              Time zone
            </span>
            <Select
              value={zone}
              onChange={(event) => {
                const picked = event.target.value;
                if (!picked || picked === zone) return;
                update.mutate({ timezone: picked }, { onSuccess: zoneSaved.flash });
              }}
            >
              {(allZones.includes(zone) ? allZones : [zone, ...allZones]).map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <SavedMark show={zoneSaved.saved} />
        </div>
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
    </>
  );
}
