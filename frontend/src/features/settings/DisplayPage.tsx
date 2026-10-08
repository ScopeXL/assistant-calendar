import { useState } from "react";

import { errorMessage } from "../../api/client";
import { useSettings, useUpdateSettings } from "../../lib/household";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { Group, Row } from "./parts";

/**
 * Settings → Display (UX §4): how the wall screen looks and when it sleeps. Settings whose
 * effect arrives with a later milestone (dimming past events, sounds, the screensaver, forcing
 * an orientation) join this page with it.
 */
export function DisplayPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  if (!settings) return null;
  return (
    <>
      <Group title="Look">
        <Row label="Theme" hint="Auto turns dark at sunset (7 PM until a location is set).">
          <Segmented
            label="Theme"
            value={settings.theme}
            onChange={(theme) => {
              update.mutate({ theme });
            }}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "auto", label: "Auto" },
            ]}
          />
        </Row>
        <Row label="Text size">
          <Segmented
            label="Text size"
            value={settings.text_size}
            onChange={(text_size) => {
              update.mutate({ text_size });
            }}
            options={[
              { value: "standard", label: "Standard" },
              { value: "large", label: "Large" },
              { value: "xl", label: "Extra large" },
            ]}
          />
        </Row>
        <Switch
          label="Daylight tint"
          hint="The wall's color follows the time of day."
          checked={settings.daylight_tint}
          onChange={(daylight_tint) => {
            update.mutate({ daylight_tint });
          }}
        />
        <Switch
          label="Reduce motion"
          hint="Everything changes at once, without moving."
          checked={settings.display_reduce_motion}
          onChange={(display_reduce_motion) => {
            update.mutate({ display_reduce_motion });
          }}
        />
      </Group>
      <Group title="Layout">
        <Row label="Rooms on the" hint="For a screen hung to your left or right.">
          <Segmented
            label="Rail side"
            value={settings.display_rail_side}
            onChange={(display_rail_side) => {
              update.mutate({ display_rail_side });
            }}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </Row>
        <Switch
          label="Today panel"
          hint="Up next and the rest of today, beside the week."
          checked={settings.display_show_today_panel}
          onChange={(display_show_today_panel) => {
            update.mutate({ display_show_today_panel });
          }}
        />
        <Row label="Return to the calendar after" hint="When nobody has touched the screen.">
          <Segmented
            label="Return to the calendar after"
            value={String(settings.display_return_minutes) as "2" | "5" | "10" | "0"}
            onChange={(value) => {
              update.mutate({ display_return_minutes: Number(value) as 0 | 2 | 5 | 10 });
            }}
            options={[
              { value: "2", label: "2 min" },
              { value: "5", label: "5 min" },
              { value: "10", label: "10 min" },
              { value: "0", label: "Never" },
            ]}
          />
        </Row>
      </Group>
      <SleepGroup />
      {update.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(update.error)}
        </p>
      ) : null}
    </>
  );
}

function SleepGroup() {
  const display = useShell() === "display";
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [from, setFrom] = useState(settings?.sleep_from ?? "22:00");
  const [to, setTo] = useState(settings?.sleep_to ?? "06:30");
  if (!settings) return null;
  const on = settings.sleep_from !== null && settings.sleep_to !== null;
  const valid = /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from !== to;
  return (
    <Group
      title="Sleep"
      note="At night the screen shows a dim clock, or goes dark. A tap wakes it for 2 minutes."
    >
      <Switch
        label="Sleep at night"
        checked={on}
        onChange={(value) => {
          update.mutate(
            value ? { sleep_from: from, sleep_to: to } : { sleep_from: null, sleep_to: null },
          );
        }}
      />
      {on ? (
        <>
          <form
            className={`flex flex-wrap items-end gap-4 ${display ? "py-5" : "py-4"}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) update.mutate({ sleep_from: from, sleep_to: to });
            }}
          >
            <TextField
              label="From"
              type="time"
              layout="numeric"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
            />
            <TextField
              label="Until"
              type="time"
              layout="numeric"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!valid || (from === settings.sleep_from && to === settings.sleep_to)}
            >
              Save times
            </Button>
          </form>
          <Row label="While asleep">
            <Segmented
              label="While asleep"
              value={settings.sleep_mode}
              onChange={(sleep_mode) => {
                update.mutate({ sleep_mode });
              }}
              options={[
                { value: "dim_clock", label: "Dim clock" },
                { value: "screen_off", label: "Screen off" },
              ]}
            />
          </Row>
        </>
      ) : null}
    </Group>
  );
}
