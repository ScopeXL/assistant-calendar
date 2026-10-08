import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { useMembers } from "../../lib/household";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { useCalendars } from "../calendar/data";
import type { CalendarInfo, PersonColor } from "../calendar/types";
import { COLORS } from "./MemberSheet";
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
 * Settings → Calendars & accounts (UX §4): the Home calendar and any other local calendars, each
 * with a color, an owner and "Show on this screen"; which one new events go to; removing one
 * (with Put back). Accounts and their synced calendars join this page in M2.
 */
export function CalendarsPage() {
  const display = useShell() === "display";
  const { data: calendars = [] } = useCalendars();
  const { data: withRemoved = [] } = useCalendars(true);
  const { data: members = [] } = useMembers();
  const refresh = useRefreshCalendars();
  const [editing, setEditing] = useState<Editing>(null);
  const removed = withRemoved.filter((c) => c.deleted);
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
      <Group
        title="Calendars"
        note="Events you add go to the calendar marked “New events go here”."
      >
        {calendars.map((calendar) => {
          const owner = members.find((m) => m.id === calendar.owner_member_id) ?? null;
          return (
            <div
              key={calendar.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${display ? "min-h-20 py-4" : "min-h-14 py-3"}`}
            >
              <span
                aria-hidden="true"
                data-person={calendar.color}
                className={`shrink-0 rounded-full bg-p ${display ? "size-8" : "size-6"}`}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`${display ? "text-d-body" : "text-body"} font-semibold`}>
                  {calendar.name}
                </span>
                <span
                  className={
                    display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                  }
                >
                  {[
                    calendar.is_default ? "New events go here" : null,
                    owner ? `${owner.name}'s` : "Everyone's",
                    calendar.visible_on_display ? null : "Hidden on the wall screen",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {calendar.read_only ? (
                <Text soft>From an account</Text>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing({ kind: "change", calendar });
                  }}
                >
                  Change
                  <span className="sr-only"> {calendar.name}</span>
                </Button>
              )}
            </div>
          );
        })}
        <div className={display ? "py-4" : "py-3"}>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing({ kind: "new" });
            }}
          >
            Add a calendar
          </Button>
        </div>
      </Group>
      {removed.length ? (
        <Group title="Removed calendars" note="Their events come back with them.">
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
                Put back
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

function CalendarSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const calendar = editing?.kind === "change" ? editing.calendar : null;
  return (
    <Sheet
      open={editing !== null}
      title={calendar ? `Change ${calendar.name}` : "Add a calendar"}
      onClose={onClose}
    >
      {editing ? (
        <CalendarForm key={calendar?.id ?? "new"} calendar={calendar} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}

function CalendarForm({ calendar, onDone }: { calendar: CalendarInfo | null; onDone: () => void }) {
  const display = useShell() === "display";
  const { data: members = [] } = useMembers();
  const refresh = useRefreshCalendars();
  const [name, setName] = useState(calendar?.name ?? "");
  const [color, setColor] = useState<PersonColor>(calendar?.color ?? "sky");
  const [owner, setOwner] = useState<string | null>(calendar?.owner_member_id ?? null);
  const [shown, setShown] = useState(calendar?.visible_on_display ?? true);
  const [isDefault, setIsDefault] = useState(calendar?.is_default ?? false);

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
              body: { ...body, ...(isDefault && !calendar.is_default ? { is_default: true } : {}) },
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
  const label = display ? "text-d-body font-semibold" : "text-body font-semibold";
  const error = save.error ?? remove.error;
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
      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${label}`}>Color</legend>
        <div className={`grid gap-2 ${display ? "grid-cols-4" : "grid-cols-2"}`}>
          {COLORS.map((option) => (
            <label
              key={option.value}
              data-person={option.value}
              className={`press flex cursor-pointer items-center gap-2 rounded-button border-2 border-line bg-surface px-2 has-checked:border-ink has-checked:ring-2 has-checked:ring-ink ${
                display ? "min-h-16 text-d-secondary" : "min-h-12 text-secondary"
              }`}
            >
              <input
                type="radio"
                name="calendar-color"
                value={option.value}
                checked={color === option.value}
                onChange={() => {
                  setColor(option.value);
                }}
                className="sr-only"
              />
              <span aria-hidden="true" className="size-6 shrink-0 rounded-full bg-p" />
              <span className="font-semibold">{option.word}</span>
            </label>
          ))}
        </div>
      </fieldset>
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
      <Switch label="Show on the wall screen" checked={shown} onChange={setShown} />
      {calendar && !calendar.is_default ? (
        <Switch
          label="New events go here"
          hint="Quick add and Add use this calendar unless you pick another."
          checked={isDefault}
          onChange={setIsDefault}
        />
      ) : null}
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={!name.trim()} pending={save.isPending}>
          {calendar ? "Save changes" : "Add calendar"}
        </Button>
        {calendar && !calendar.is_default ? (
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
    </form>
  );
}
