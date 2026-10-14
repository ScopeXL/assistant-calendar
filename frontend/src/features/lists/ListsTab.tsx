import { Link } from "@tanstack/react-router";
import { ChevronRight, ListChecks, ListX, Plus } from "lucide-react";
import { useState } from "react";

import { zonedParts } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { EmptyState, QuietLine } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { Pop } from "../../ui/Pop";
import { useList, useListChanges, useLists } from "./data";
import { AddBar, ItemRows } from "./ListItems";
import { ChangeListPanel, NewListPanel, tileCount } from "./ListsRoom";
import { lastChangeLine } from "./words";

/** Lists on a phone (UX §5): the lists, or one list with its add field above the tabs. */
export function ListsTab({ path }: { path: string[] }) {
  const [listId] = path;
  return listId ? <PhoneList listId={listId} /> : <PhoneLists />;
}

function PhoneLists() {
  const { data: lists, isSuccess } = useLists();
  const { data: members = [] } = useMembers();
  const today = zonedParts(useMinute()).day;
  const [making, setMaking] = useState(false);
  return (
    <Screen
      title="Lists"
      actions={
        <Button
          block
          onClick={() => {
            setMaking(true);
          }}
        >
          <Plus aria-hidden="true" className="size-5" />
          New List
        </Button>
      }
    >
      {isSuccess && lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          note="Groceries, to-dos, packing: everyone sees them on the wall and on their phones."
        />
      ) : (
        <ul className="divide-y divide-line rounded-chip border border-line bg-surface">
          {(lists ?? []).map((list) => (
            <li key={list.id}>
              <Link
                to="/$room/$"
                params={{ room: "lists", _splat: list.id }}
                className="press-row flex min-h-16 items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-row font-bold break-words">{list.name}</span>
                  <Pop value={tileCount(list)} className="text-secondary font-semibold" />
                  {list.last_change ? (
                    <span className="text-secondary text-ink-soft">
                      {lastChangeLine(
                        list.last_change,
                        (id) => members.find((m) => m.id === id)?.name,
                        today,
                      )}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" className="shrink-0 text-ink-soft" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewListPanel
        open={making}
        onClose={() => {
          setMaking(false);
        }}
      />
    </Screen>
  );
}

function PhoneList({ listId }: { listId: string }) {
  const { data: detail, isError } = useList(listId);
  const { clearDone } = useListChanges();
  const [changing, setChanging] = useState(false);
  if (isError) {
    return (
      <Screen title="Lists" back="/lists">
        <EmptyState icon={ListX} title="That list isn't here any more" />
      </Screen>
    );
  }
  if (!detail) return null;
  const { list } = detail;
  return (
    <Screen
      title={list.name}
      back="/lists"
      actions={
        <div className="min-w-0 flex-1">
          <AddBar detail={detail} />
        </div>
      }
    >
      <div className="-mt-3 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-semibold text-ink-soft">
          <Pop value={tileCount(list)} />
        </p>
        <div className="flex gap-2">
          {list.done_count > 0 ? (
            <Button
              variant="secondary"
              pending={clearDone.isPending}
              onClick={() => {
                clearDone.mutate({ listId: list.id });
              }}
            >
              Clear Done
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              setChanging(true);
            }}
          >
            Change List
          </Button>
        </div>
      </div>
      {detail.items.length === 0 && detail.done.length === 0 ? (
        <QuietLine>{`Nothing on ${list.name} yet. Add the first thing.`}</QuietLine>
      ) : (
        <div className="rounded-chip border border-line bg-surface">
          <ItemRows detail={detail} />
        </div>
      )}
      <ChangeListPanel
        key={list.id}
        list={list}
        open={changing}
        onClose={() => {
          setChanging(false);
        }}
      />
    </Screen>
  );
}
