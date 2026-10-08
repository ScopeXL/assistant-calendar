import { useState } from "react";

import {
  addDays,
  monthYear,
  shortDate,
  wallNow,
  weekOf,
  weekSpan,
  zonedParts,
} from "../../lib/dates";
import { displayState, updateDisplay, type BoardView } from "../../lib/displayState";
import { useMembers, useSettings } from "../../lib/household";
import { usePluginModules } from "../usePluginModules";
import { useStore } from "../../lib/store";
import { useMinute } from "../../lib/time";
import { AddPanel } from "./AddPanel";
import { BoardHeader } from "./BoardHeader";
import { useEventChanges, useOccurrences } from "./data";
import { DayView } from "./DayView";
import { EventSheet } from "./EventSheet";
import { MonthView, monthGrid } from "./MonthView";
import { PeopleView } from "./PeopleView";
import { ScopeChooser } from "./ScopeChooser";
import { TodayView } from "./TodayView";
import type { Occurrence, Scope } from "./types";
import { WeekView } from "./WeekView";

function homeView(setting: string | undefined): BoardView {
  if (setting === "today") return "today";
  if (setting === "people") return "people";
  return "week";
}

/**
 * The Calendar room on the wall screen (UX §3, §4): the board in its current view, its header,
 * and the side panel (an event, or Add). What it shows lives in the display's shared state, so
 * the idle machine can put it back to this week (lib/displayState).
 */
export function CalendarRoom() {
  const state = useStore(displayState);
  const { data: settings } = useSettings();
  const { data: members = [] } = useMembers();
  const minute = useMinute();
  const now = wallNow(minute);
  const today = zonedParts(minute).day;
  const weekStartsOn = settings?.week_starts_on ?? 6;
  const view = state.view ?? homeView(settings?.display_home_view);
  const panelShown = state.panelShown ?? settings?.display_show_today_panel ?? true;
  const dimPast = settings?.display_dim_past ?? true;
  const changes = useEventChanges();
  const pills = usePluginModules().flatMap((module) =>
    module.boardPill ? [{ id: module.id, Pill: module.boardPill }] : [],
  );
  const [dragging, setDragging] = useState(false);
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ occurrence: Occurrence; toDay: string } | null>(
    null,
  );

  const week = weekOf(addDays(today, state.weekOffset * 7), weekStartsOn);
  const focusDay = state.day ?? today;
  const month = monthGrid(today, state.monthOffset, weekStartsOn);
  const range =
    view === "day"
      ? { from: focusDay, to: addDays(focusDay, 1) }
      : view === "month"
        ? { from: month.days[0] ?? today, to: addDays(month.days.at(-1) ?? today, 1) }
        : view === "today"
          ? { from: today, to: addDays(today, 7) }
          : view === "people"
            ? { from: today, to: addDays(today, 1) }
            : { from: week[0] ?? today, to: addDays(week[6] ?? today, 1) };
  const { data } = useOccurrences(range.from, range.to);
  const occurrences = data?.occurrences ?? [];

  const open = (occurrence: Occurrence) => {
    if (!occurrence.event_id) return;
    updateDisplay({
      panel: {
        kind: "event",
        eventId: occurrence.event_id,
        recurrenceId: occurrence.recurrence_id ?? null,
        key: occurrence.key,
      },
    });
  };
  const add = (day: string | null, hour: number | null = null) => {
    updateDisplay({ panel: { kind: "add", day, hour } });
  };
  const move = (occurrence: Occurrence, toDay: string) => {
    if (!occurrence.event_id) return;
    if (occurrence.is_recurring) {
      setPendingMove({ occurrence, toDay });
      return;
    }
    changes.move.mutate({
      target: { eventId: occurrence.event_id, recurrenceId: null },
      scope: "all",
      toDate: toDay,
      title: occurrence.title,
    });
  };

  const page = (step: -1 | 1) => {
    if (view === "day") updateDisplay({ day: addDays(focusDay, step) });
    else if (view === "month") updateDisplay({ monthOffset: state.monthOffset + step });
    else updateDisplay({ weekOffset: state.weekOffset + step });
  };
  const header = {
    week: {
      title: monthYear(week[3] ?? today),
      subtitle: weekSpan(week),
      homeLabel: "This week",
      atHome: state.weekOffset === 0,
      home: () => {
        updateDisplay({ weekOffset: 0 });
      },
    },
    day: {
      title: shortDate(focusDay),
      subtitle: focusDay === today ? "today" : undefined,
      homeLabel: "Today",
      atHome: focusDay === today,
      home: () => {
        updateDisplay({ day: null });
      },
    },
    month: {
      title: monthYear(month.first),
      subtitle: undefined,
      homeLabel: "This month",
      atHome: state.monthOffset === 0,
      home: () => {
        updateDisplay({ monthOffset: 0 });
      },
    },
    people: {
      title: "Who's doing what",
      subtitle: shortDate(today),
      homeLabel: "Today",
      atHome: true,
      home: () => undefined,
    },
    today: {
      title: shortDate(today),
      subtitle: "today",
      homeLabel: "This week",
      atHome: true,
      home: () => {
        updateDisplay({ view: "week" });
      },
    },
  }[view];

  return (
    <section
      aria-label={view === "week" ? "This week" : header.title}
      className="@container flex min-h-0 flex-1 flex-col"
    >
      <BoardHeader
        title={header.title}
        subtitle={header.subtitle}
        view={view}
        onView={(next) => {
          updateDisplay({ view: next });
        }}
        homeLabel={header.homeLabel}
        atHome={header.atHome}
        onPage={page}
        onHome={header.home}
        members={members}
        people={state.people}
        onPeople={(people) => {
          updateDisplay({ people });
        }}
        panelShown={panelShown}
        onTogglePanel={() => {
          updateDisplay({ panelShown: !panelShown });
        }}
        notice={dragging ? "Drop on a day" : null}
        pills={pills.map(({ id, Pill }) => (
          <Pill key={id} />
        ))}
      />
      {view === "week" ? (
        <WeekView
          days={week}
          today={today}
          now={now}
          occurrences={occurrences}
          members={members}
          dimPast={dimPast}
          people={state.people}
          onOpen={open}
          onAdd={(day) => {
            add(day);
          }}
          onMore={(day) => {
            updateDisplay({ view: "day", day });
          }}
          onMove={move}
          onSwipe={page}
          onDragging={setDragging}
          lit={state.panel?.kind === "add" || state.panel?.kind === "edit" ? draftDay : null}
        />
      ) : view === "day" ? (
        <DayView
          day={focusDay}
          now={now}
          occurrences={occurrences}
          members={members}
          dimPast={dimPast}
          people={state.people}
          onOpen={open}
          onAdd={(hour) => {
            add(focusDay, hour);
          }}
        />
      ) : view === "month" ? (
        <MonthView
          grid={month}
          today={today}
          occurrences={occurrences}
          members={members}
          people={state.people}
          onDay={(day) => {
            updateDisplay({ view: "day", day });
          }}
        />
      ) : view === "people" ? (
        <PeopleView
          today={today}
          now={now}
          occurrences={occurrences}
          members={members}
          dimPast={dimPast}
          onOpen={open}
        />
      ) : (
        <TodayView
          today={today}
          now={now}
          occurrences={occurrences}
          members={members}
          onOpen={open}
        />
      )}
      <EventSheet
        panel={state.panel?.kind === "event" ? state.panel : null}
        onClose={() => {
          updateDisplay({ panel: null });
        }}
        onChange={(eventId, recurrenceId) => {
          updateDisplay({ panel: { kind: "edit", eventId, recurrenceId } });
        }}
      />
      <AddPanel
        panel={state.panel?.kind === "add" || state.panel?.kind === "edit" ? state.panel : null}
        today={today}
        onDay={setDraftDay}
        onClose={() => {
          updateDisplay({ panel: null });
        }}
        onType={(type) => {
          if (state.panel?.kind === "add") updateDisplay({ panel: { ...state.panel, type } });
        }}
      />
      <ScopeChooser
        open={pendingMove !== null}
        verb="Move"
        title={pendingMove?.occurrence.title ?? ""}
        onChoose={(scope: Scope) => {
          const pending = pendingMove;
          setPendingMove(null);
          if (!pending?.occurrence.event_id) return;
          changes.move.mutate({
            target: {
              eventId: pending.occurrence.event_id,
              recurrenceId: pending.occurrence.recurrence_id ?? null,
            },
            scope,
            toDate: pending.toDay,
            title: pending.occurrence.title,
          });
        }}
        onCancel={() => {
          setPendingMove(null);
        }}
      />
    </section>
  );
}
