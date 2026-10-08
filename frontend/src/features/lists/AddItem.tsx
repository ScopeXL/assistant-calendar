import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { addDays, shortWeekday, zonedParts } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { WhoPicker } from "../../ui/WhoPicker";
import type { AddEditorProps } from "../registry";
import { useListChanges, useLists } from "./data";
import { useWallActor } from "./ListItems";
import { SUGGESTED } from "./ListsRoom";
import { splitItems } from "./words";

/**
 * Add → Item (UX §4 "The Add panel for other things"): which list (the open one first), what
 * (commas make several: "Milk, eggs, bread"), and, if it matters, who and which day.
 */
export function AddItem({ day: boardDay, onDone }: AddEditorProps) {
  const display = useShell() === "display";
  const { data: lists = [] } = useLists();
  const { data: members = [] } = useMembers();
  const { addItems, createList } = useListChanges();
  const [actor] = useWallActor();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const today = zonedParts(useMinute()).day;
  const openList = /^\/lists\/([^/]+)/.exec(pathname)?.[1];
  const [listId, setListId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [who, setWho] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(boardDay);
  const chosen =
    lists.find((list) => list.id === listId) ??
    lists.find((list) => list.id === openList) ??
    lists.find((list) => list.kind === "grocery") ??
    lists[0];
  const texts = splitItems(text);
  const label = (d: string) =>
    d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : shortWeekday(d);
  const gap = display ? "gap-6" : "gap-5";
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";

  if (!chosen) {
    return (
      <div className={`flex flex-col ${gap}`}>
        <p className={heading}>Make a list first.</p>
        <ChipRow label="Usual lists">
          {SUGGESTED.map((name) => (
            <Chip
              key={name}
              onClick={() => {
                createList.mutate({ name });
              }}
            >
              {name}
            </Chip>
          ))}
        </ChipRow>
      </div>
    );
  }
  return (
    <form
      className={`flex flex-col ${gap}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!texts.length) return;
        addItems.mutate(
          { listId: chosen.id, texts, member: actor, dueDate: day, assignee: who },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="flex flex-col gap-2">
        <p className={heading}>Which list</p>
        <ChipRow label="Which list">
          {lists.map((list) => (
            <Chip
              key={list.id}
              on={list.id === chosen.id}
              onClick={() => {
                setListId(list.id);
              }}
            >
              {list.name}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <TextField
        label="What"
        hint="Commas add several: milk, eggs, bread."
        autoComplete="off"
        autoFocus
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <div className="flex flex-col gap-2">
        <p className={heading}>Who</p>
        <WhoPicker
          label="Who"
          members={members}
          value={who ? [who] : []}
          onChange={(ids) => {
            setWho(ids[0] ?? null);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Day</p>
        <ChipRow label="Day">
          <Chip
            on={day === null}
            onClick={() => {
              setDay(null);
            }}
          >
            No day
          </Chip>
          {[0, 1, 2, 3, 4, 5, 6].map((n) => {
            const d = addDays(today, n);
            return (
              <Chip
                key={d}
                on={day === d}
                onClick={() => {
                  setDay(d);
                }}
              >
                {label(d)}
              </Chip>
            );
          })}
        </ChipRow>
      </div>
      {addItems.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(addItems.error)}
        </p>
      ) : null}
      <Button type="submit" block disabled={!texts.length} pending={addItems.isPending}>
        {texts.length > 1 ? `Add ${String(texts.length)} items` : "Add item"}
      </Button>
    </form>
  );
}
