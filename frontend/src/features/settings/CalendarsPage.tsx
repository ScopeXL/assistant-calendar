import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, notSaved, unwrap } from "../../api/client";
import { useMembers } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { useSavedFlash } from "../../lib/savedFlash";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { ColorPicker, usedBy } from "../../ui/ColorPicker";
import { useFieldHint, useFieldLabel } from "../../ui/Field";
import { ListRow } from "../../ui/ListRow";
import { SavedMark } from "../../ui/SavedMark";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { ChoiceRow } from "../../ui/ValueRow";
import { calendarChoiceLabel, takesEvents, useCalendars } from "../calendar/data";
import { usePluginModules } from "../usePluginModules";
import type { CalendarInfo, PersonColor } from "../calendar/types";
import { Group, Text } from "./parts";

type Editing = { kind: "new" } | { kind: "change"; calendar: CalendarInfo } | null;

function useRefreshCalendars() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendars"] }),
      queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
    ]);
  };
}

/**
 * Settings → Calendars & Accounts (UX §4): first the Default calendar, where new events go; then
 * the Home calendar and any other local calendars, a row each that opens its sheet (a color, an
 * owner, "Show on the wall screen", removing it, with Put back). Accounts and their synced
 * calendars follow, from the calendar_sync plugin.
 */
export function CalendarsPage() {
  const display = useShell() === "display";
  const { data: everyCalendar = [] } = useCalendars();
  const { data: withRemoved = [] } = useCalendars(true);
  // Synced calendars show under their accounts (the calendar_sync plugin's section).
  const calendars = everyCalendar.filter((c) => c.kind === "local");
  const Accounts = usePluginModules().find((m) => m.id === "calendar_sync")?.settings?.accounts;
  const { data: members = [] } = useMembers();
  const refresh = useRefreshCalendars();
  const [editing, setEditing] = useState<Editing>(null);
  const removed = withRemoved.filter((c) => c.deleted && c.kind === "local");
  const restore = useMutation({
    mutationFn: async (calendar: CalendarInfo) =>
      unwrap(
        await api.POST("/api/calendar/calendars/{calendar_id}/restore", {
          params: { path: { calendar_id: calendar.id } },
        }),
      ),
    onSuccess: async (_data, calendar) => {
      await refresh();
      showToast(`Put back ${calendar.name}`);
    },
  });
  return (
    <>
      <DefaultCalendar calendars={everyCalendar} />
      <Group title="Calendars">
        {calendars.map((calendar) => {
          const owner = members.find((m) => m.id === calendar.owner_member_id) ?? null;
          const notes = [
            calendar.is_default ? "Default calendar" : null,
            owner ? `${owner.name}'s` : "Everyone's",
            calendar.visible_on_display ? null : "Hidden on paired screens",
          ]
            .filter(Boolean)
            .join(" · ");
          const dot = (
            <span
              aria-hidden="true"
              data-person={calendar.color}
              className={`shrink-0 rounded-full bg-p ${display ? "size-8" : "size-6"}`}
            />
          );
          return calendar.read_only ? (
            <div
              key={calendar.id}
              className={`flex items-center gap-4 py-2 ${display ? "min-h-tap-primary" : "min-h-14"}`}
            >
              {dot}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`${display ? "text-d-body" : "text-row"} font-semibold`}>
                  {calendar.name}
                </span>
                <span
                  className={
                    display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                  }
                >
                  {`${notes} · From an account`}
                </span>
              </div>
            </div>
          ) : (
            <ListRow
              key={calendar.id}
              label={`Edit ${calendar.name}`}
              leading={dot}
              title={calendar.name}
              subtitle={notes}
              onClick={() => {
                setEditing({ kind: "change", calendar });
              }}
            />
          );
        })}
        <div className={display ? "py-4" : "py-3"}>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing({ kind: "new" });
            }}
          >
            Add a Calendar
          </Button>
        </div>
      </Group>
      {Accounts ? <Accounts /> : null}
      {removed.length ? (
        <Group title="Removed Calendars" note="Their events come back with them.">
          {removed.map((calendar) => (
            <div
              key={calendar.id}
              className={`flex flex-wrap items-center justify-between gap-4 ${display ? "min-h-20 py-4" : "min-h-14 py-3"}`}
            >
              <Text>{calendar.name}</Text>
              <Button
                variant="secondary"
                pending={restore.isPending && restore.variables.id === calendar.id}
                onClick={() => {
                  restore.mutate(calendar);
                }}
              >
                Put Back
                <span className="sr-only"> {calendar.name}</span>
              </Button>
            </div>
          ))}
        </Group>
      ) : null}
      <CalendarSheet
        editing={editing}
        onClose={() => {
          setEditing(null);
        }}
      />
    </>
  );
}

/**
 * Where new events go (UX §4): any calendar that takes events, a synced one from an account too,
 * so what's added on the wall can reach everyone's phones. Add starts with it and can still pick
 * another. It saves as it changes, like every setting (ADR 0029).
 */
function DefaultCalendar({ calendars }: { calendars: CalendarInfo[] }) {
  const display = useShell() === "display";
  const refresh = useRefreshCalendars();
  const saved = useSavedFlash();
  const choices = calendars.filter(takesEvents);
  const current = choices.find((calendar) => calendar.is_default) ?? null;
  const make = useMutation({
    mutationFn: (calendar: CalendarInfo) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/calendar/calendars/{calendar_id}/default", {
            params: { path: { calendar_id: calendar.id } },
          }),
        ),
      ),
    onSuccess: async () => {
      await refresh();
      saved.flash();
    },
    onError: (error) => {
      showToast(notSaved(error));
    },
  });
  if (!choices.length) return null;
  // The one just picked shows while it saves.
  const shown = make.isPending ? make.variables.id : (current?.id ?? "");
  return (
    <Group>
      <div className={`flex flex-col gap-1 ${display ? "py-5" : "py-4"}`}>
        <ChoiceRow
          strong
          label="Default calendar"
          hint="New events go here. You can pick another when you add one."
          choices={choices.map((calendar) => ({
            value: calendar.id,
            label: calendarChoiceLabel(calendar),
          }))}
          value={shown}
          onChange={(id) => {
            const picked = choices.find((calendar) => calendar.id === id);
            if (picked && picked.id !== current?.id) make.mutate(picked);
          }}
        />
        <SavedMark show={saved.saved} />
      </div>
    </Group>
  );
}

/**
 * Why one of the household's own calendars has no Remove (ADR 0032): Sunroom always keeps one
 * of its own, so new events have somewhere to go even if an account's calendar goes; and the
 * default calendar stays while it's the default. Null when it can go.
 */
export function whyItStays(
  calendar: CalendarInfo,
  calendars: readonly CalendarInfo[],
): string | null {
  const others = calendars.filter(
    (other) => other.kind === "local" && takesEvents(other) && other.id !== calendar.id,
  );
  if (!others.length) return "Sunroom keeps one calendar of its own, so this one stays.";
  if (calendar.is_default)
    return "New events go here, so it stays while it's the default calendar.";
  return null;
}

function CalendarSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const calendar = editing?.kind === "change" ? editing.calendar : null;
  return (
    <Sheet
      open={editing !== null}
      title={calendar ? `Edit ${calendar.name}` : "Add a Calendar"}
      onClose={onClose}
    >
      {editing ? (
        <CalendarForm key={calendar?.id ?? "new"} calendar={calendar} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}

function CalendarForm({ calendar, onDone }: { calendar: CalendarInfo | null; onDone: () => void }) {
  const { data: members = [] } = useMembers();
  const { data: calendars = [] } = useCalendars();
  const refresh = useRefreshCalendars();
  const [name, setName] = useState(calendar?.name ?? "");
  const [color, setColor] = useState<PersonColor>(calendar?.color ?? "sky");
  const [owner, setOwner] = useState<string | null>(calendar?.owner_member_id ?? null);
  const [shown, setShown] = useState(calendar?.visible_on_display ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        color,
        owner_member_id: owner,
        visible_on_display: shown,
      };
      return calendar
        ? unwrap(
            await api.PATCH("/api/calendar/calendars/{calendar_id}", {
              params: { path: { calendar_id: calendar.id } },
              body,
            }),
          )
        : unwrap(await api.POST("/api/calendar/calendars", { body }));
    },
    onSuccess: async (saved) => {
      await refresh();
      showToast(calendar ? "Changes saved" : `Added ${saved.name}`);
      onDone();
    },
  });
  const remove = useMutation({
    mutationFn: async (target: CalendarInfo) =>
      unwrap(
        await api.DELETE("/api/calendar/calendars/{calendar_id}", {
          params: { path: { calendar_id: target.id } },
        }),
      ),
    onSuccess: async (_data, target) => {
      await refresh();
      showToast(`Removed ${target.name}`, {
        label: "Undo",
        onAction: () => {
          void (async () => {
            await api.POST("/api/calendar/calendars/{calendar_id}/restore", {
              params: { path: { calendar_id: target.id } },
            });
            await refresh();
          })();
        },
      });
      onDone();
    },
  });
  const label = useFieldLabel();
  const hint = useFieldHint();
  const error = save.error ?? remove.error;
  // As it is now: another screen may have picked a new default since the sheet opened.
  const stays = calendar
    ? whyItStays(calendars.find((other) => other.id === calendar.id) ?? calendar, calendars)
    : null;
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <TextField
        label="Name"
        value={name}
        maxLength={80}
        autoComplete="off"
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <ColorPicker name="calendar-color" value={color} onChange={setColor} used={usedBy(members)} />
      <div className="flex flex-col gap-2">
        <p className={label}>Whose calendar</p>
        <ChipRow label="Whose calendar">
          <Chip
            on={owner === null}
            onClick={() => {
              setOwner(null);
            }}
          >
            <Avatar member={null} size="xs" />
            Everyone
          </Chip>
          {members.map((member) => (
            <Chip
              key={member.id}
              on={owner === member.id}
              onClick={() => {
                setOwner(member.id);
              }}
            >
              <Avatar member={member} size="xs" />
              {member.name}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <Switch label="Show on paired screens" checked={shown} onChange={setShown} />
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={!name.trim()} pending={save.isPending}>
          {calendar ? "Save Changes" : "Add Calendar"}
        </Button>
        {calendar && !stays ? (
          <Button
            variant="quiet-danger"
            pending={remove.isPending}
            onClick={() => {
              remove.mutate(calendar);
            }}
          >
            Remove {calendar.name}
          </Button>
        ) : null}
      </div>
      {stays ? <p className={hint}>{stays}</p> : null}
    </form>
  );
}
