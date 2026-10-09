import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "../../api/client";
import { zonedParts } from "../../lib/dates";
import { useMembers, usePlugins } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { useShell } from "../../ui/shell";
import { SidePanel } from "../../ui/SidePanel";
import { TextField } from "../../ui/TextField";
import { WhoPicker } from "../../ui/WhoPicker";
import { Group, Text } from "../settings/parts";
import { PluginSettingsForm } from "../settings/PluginSettingsForm";
import { personOf } from "./ChoreBoard";
import {
  useChoreChanges,
  useChoreSettings,
  useRewards,
  useRoutines,
  type Reward,
  type Routine,
  type StepIn,
} from "./data";
import { STEP_ICONS, stepIcon } from "./icons";
import { RewardPanel } from "./RewardsPage";
import { clockText } from "./words";

const STARTS = ["06:30", "07:00", "07:30", "18:30", "19:00", "19:30", "20:00"];
const LASTS: [string, number][] = [
  ["30 min", 30],
  ["1 hour", 60],
  ["2 hours", 120],
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUGGESTED_STEPS: { icon: string; title: string }[] = [
  { icon: "toothbrush", title: "Brush teeth" },
  { icon: "shirt", title: "Pajamas on" },
  { icon: "bath", title: "Bath" },
  { icon: "book", title: "Read a book" },
  { icon: "bed", title: "Into bed" },
  { icon: "shirt", title: "Get dressed" },
  { icon: "plate", title: "Breakfast" },
  { icon: "backpack", title: "Pack your bag" },
  { icon: "shoes", title: "Shoes on" },
  { icon: "hands", title: "Wash hands" },
  { icon: "tidy", title: "Tidy up" },
  { icon: "dog", title: "Feed the pet" },
];

/**
 * Settings → Chores (UX §3, §4): turn stars, rewards, routines and a parent's check on or off;
 * the rewards stars buy; the routines kids run; and giving or taking stars. Chores themselves
 * are added and changed in the Chores room.
 */
export function SettingsChores() {
  const { data: plugins = [] } = usePlugins();
  const plugin = plugins.find((p) => p.id === "chores");
  const settings = useChoreSettings();
  return (
    <>
      {plugin ? (
        <Group title="What Chores Include">
          <PluginSettingsForm
            pluginId="chores"
            spec={plugin.settings_spec}
            values={plugin.settings}
          />
        </Group>
      ) : null}
      {settings.rewards ? <RewardsGroup /> : null}
      {settings.routines ? <RoutinesGroup /> : null}
      {settings.stars ? <AdjustGroup /> : null}
    </>
  );
}

function RewardsGroup() {
  const display = useShell() === "display";
  const { data } = useRewards();
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  return (
    <Group title="Rewards">
      {data?.rewards.length === 0 ? (
        <div className={display ? "py-4" : "py-3"}>
          <Text soft>Rewards are what stars buy: movie night, an ice cream run.</Text>
        </div>
      ) : null}
      {(data?.rewards ?? []).map((reward) => (
        <div
          key={reward.id}
          className={`flex items-center justify-between gap-4 ${display ? "min-h-20 py-3" : "min-h-14 py-2"}`}
        >
          <Text>{`${reward.title} · ★${String(reward.cost_points)}`}</Text>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(reward);
            }}
          >
            Change
            <span className="sr-only"> {reward.title}</span>
          </Button>
        </div>
      ))}
      <div className={display ? "py-4" : "py-3"}>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing("new");
          }}
        >
          Add reward
        </Button>
      </div>
      <RewardPanel
        reward={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
      />
    </Group>
  );
}

function RoutinesGroup() {
  const display = useShell() === "display";
  const today = zonedParts(useMinute()).day;
  const { data } = useRoutines(today);
  const { data: members = [] } = useMembers();
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const routines = data?.routines ?? [];
  return (
    <Group title="Routines">
      {routines.length === 0 ? (
        <div className={display ? "py-4" : "py-3"}>
          <Text soft>
            A routine is a short checklist a kid runs on their own: pajamas, teeth, book.
          </Text>
        </div>
      ) : null}
      {routines.map((routine) => {
        const kid = personOf(members, routine.member_id);
        return (
          <div
            key={routine.id}
            className={`flex items-center justify-between gap-4 ${display ? "min-h-20 py-3" : "min-h-14 py-2"}`}
          >
            <div className="flex flex-col">
              <Text>{routine.title}</Text>
              <Text soft>
                {`${kid ? kid.name : "Every kid"} · ${clockText(routine.window_start)} · ${String(routine.steps.length)} steps`}
              </Text>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(routine);
              }}
            >
              Change
              <span className="sr-only"> {routine.title}</span>
            </Button>
          </div>
        );
      })}
      <div className={display ? "py-4" : "py-3"}>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing("new");
          }}
        >
          Add routine
        </Button>
      </div>
      <SidePanel
        open={editing !== null}
        title={editing && editing !== "new" ? `Change ${editing.title}` : "Add Routine"}
        onClose={() => {
          setEditing(null);
        }}
      >
        {editing !== null ? (
          <RoutineForm
            key={editing === "new" ? "new" : editing.id}
            routine={editing === "new" ? null : editing}
            onClose={() => {
              setEditing(null);
            }}
          />
        ) : null}
      </SidePanel>
    </Group>
  );
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmmOf = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

/** A routine's fields and its steps, each with a picture from the step library. */
function RoutineForm({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
  const display = useShell() === "display";
  const { data: members = [] } = useMembers();
  const { stars: starsOn } = useChoreSettings();
  const { saveRoutine, removeRoutine } = useChoreChanges();
  const [title, setTitle] = useState(routine?.title ?? "Bedtime routine");
  const [kid, setKid] = useState<string | null>(routine?.member_id ?? null);
  const [days, setDays] = useState<number[]>(routine?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [start, setStart] = useState(routine?.window_start ?? "19:30");
  const initialLast = routine
    ? (minutesOf(routine.window_end) - minutesOf(routine.window_start) + 1440) % 1440
    : 60;
  const [last, setLast] = useState(initialLast || 60);
  const [points, setPoints] = useState(routine?.points ?? 0);
  const [steps, setSteps] = useState<StepIn[]>(
    routine?.steps.map((step) => ({ id: step.id, title: step.title, icon: step.icon ?? null })) ??
      [],
  );
  const [choosingIcon, setChoosingIcon] = useState<number | null>(null);
  const gap = display ? "gap-6" : "gap-5";
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";
  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    const [step] = next.splice(from, 1);
    if (step) next.splice(to, 0, step);
    setSteps(next);
  };
  const ready =
    title.trim() !== "" &&
    days.length > 0 &&
    steps.length > 0 &&
    steps.every((s) => s.title.trim());
  return (
    <form
      className={`flex flex-col ${gap}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        saveRoutine.mutate(
          {
            routine,
            fields: {
              title: title.trim(),
              member_id: kid,
              days,
              window_start: start,
              window_end: hhmmOf(minutesOf(start) + last),
              icon: null,
              points: starsOn ? points : (routine?.points ?? 0),
            },
            steps: steps.map((step) => ({ ...step, title: step.title.trim() })),
          },
          { onSuccess: onClose },
        );
      }}
    >
      <TextField
        label="Name"
        autoComplete="off"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <div className="flex flex-col gap-2">
        <p className={heading}>Whose</p>
        <ChipRow label="Whose">
          <Chip
            on={kid === null}
            onClick={() => {
              setKid(null);
            }}
          >
            Every kid
          </Chip>
        </ChipRow>
        <WhoPicker
          label="Which kid"
          members={members}
          kidsOnly
          everyone={false}
          value={kid ? [kid] : []}
          onChange={(ids) => {
            setKid(ids[0] ?? null);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Days</p>
        <ChipRow label="Days">
          {DAYS.map((name, index) => (
            <Chip
              key={name}
              on={days.includes(index)}
              onClick={() => {
                setDays(
                  days.includes(index) ? days.filter((d) => d !== index) : [...days, index].sort(),
                );
              }}
            >
              {name}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <div className="flex flex-col gap-2">
        <p className={heading}>Starts</p>
        <ChipRow label="Starts">
          {[...new Set([...STARTS, start])].sort().map((hhmm) => (
            <Chip
              key={hhmm}
              on={start === hhmm}
              onClick={() => {
                setStart(hhmm);
              }}
            >
              {clockText(hhmm)}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Shows for">
          {LASTS.map(([label, minutes]) => (
            <Chip
              key={label}
              on={last === minutes}
              onClick={() => {
                setLast(minutes);
              }}
            >
              {`for ${label}`}
            </Chip>
          ))}
        </ChipRow>
      </div>
      {starsOn ? (
        <div className="flex flex-col gap-2">
          <p className={heading}>Stars for finishing</p>
          <ChipRow label="Stars for finishing">
            {[0, 1, 2, 3, 5].map((count) => (
              <Chip
                key={count}
                on={points === count}
                onClick={() => {
                  setPoints(count);
                }}
              >
                {count === 0 ? "None" : `★${String(count)}`}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <p className={heading}>Steps</p>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => {
            const Icon = stepIcon(step.icon);
            return (
              <li
                key={step.id ?? `new-${String(index)}`}
                className="flex flex-col gap-2 rounded-button border-2 border-line p-3"
              >
                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    icon
                    aria-label={`Picture for step ${String(index + 1)}`}
                    onClick={() => {
                      setChoosingIcon(choosingIcon === index ? null : index);
                    }}
                  >
                    <Icon aria-hidden="true" className={display ? "size-8" : "size-6"} />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={`Step ${String(index + 1)}`}
                      hideLabel
                      autoComplete="off"
                      value={step.title}
                      onChange={(event) => {
                        const next = [...steps];
                        next[index] = { ...step, title: event.target.value };
                        setSteps(next);
                      }}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    icon
                    aria-label={`Move step ${String(index + 1)} up`}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, index - 1);
                    }}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    icon
                    aria-label={`Move step ${String(index + 1)} down`}
                    disabled={index === steps.length - 1}
                    onClick={() => {
                      move(index, index + 1);
                    }}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    icon
                    aria-label={`Remove step ${String(index + 1)}`}
                    onClick={() => {
                      setSteps(steps.filter((_, at) => at !== index));
                    }}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                {choosingIcon === index ? (
                  <ChipRow label="Pictures">
                    {Object.entries(STEP_ICONS).map(([key, { label, Icon: Option }]) => (
                      <Chip
                        key={key}
                        on={step.icon === key}
                        onClick={() => {
                          const next = [...steps];
                          next[index] = { ...step, icon: key };
                          setSteps(next);
                          setChoosingIcon(null);
                        }}
                      >
                        <Option aria-hidden="true" className={display ? "size-7" : "size-5"} />
                        {label}
                      </Chip>
                    ))}
                  </ChipRow>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}>
          Add a step
        </p>
        <ChipRow label="Add a step">
          {SUGGESTED_STEPS.map((suggestion) => {
            const Icon = stepIcon(suggestion.icon);
            return (
              <Chip
                key={suggestion.title}
                onClick={() => {
                  setSteps([
                    ...steps,
                    { id: null, title: suggestion.title, icon: suggestion.icon },
                  ]);
                }}
              >
                <Icon aria-hidden="true" className={display ? "size-7" : "size-5"} />
                {suggestion.title}
              </Chip>
            );
          })}
          <Chip
            onClick={() => {
              setSteps([...steps, { id: null, title: "", icon: "smile" }]);
            }}
          >
            Another step
          </Chip>
        </ChipRow>
      </div>
      {saveRoutine.isError || removeRoutine.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(saveRoutine.error ?? removeRoutine.error)}
        </p>
      ) : null}
      <Button type="submit" block disabled={!ready} pending={saveRoutine.isPending}>
        {routine ? "Save changes" : "Add Routine"}
      </Button>
      {routine ? (
        <Button
          variant="quiet-danger"
          pending={removeRoutine.isPending}
          onClick={() => {
            removeRoutine.mutate({ routine }, { onSuccess: onClose });
          }}
        >
          Remove {routine.title}
        </Button>
      ) : null}
    </form>
  );
}

/** Give or take stars (a parent): for a reward outside the app, or a chore done twice. */
function AdjustGroup() {
  const display = useShell() === "display";
  const { data: members = [] } = useMembers();
  const { adjust } = useChoreChanges();
  const [kid, setKid] = useState<string | null>(null);
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const chosen = personOf(members, kid);
  return (
    <Group title="Give or Take Stars">
      <div className={`flex flex-col ${display ? "gap-5 py-5" : "gap-4 py-4"}`}>
        <WhoPicker
          label="Who"
          members={members}
          kidsOnly
          everyone={false}
          value={kid ? [kid] : []}
          onChange={(ids) => {
            setKid(ids[0] ?? null);
          }}
        />
        <ChipRow label="How many">
          {[-5, -1, 1, 5, 10].map((value) => (
            <Chip
              key={value}
              on={points === value}
              onClick={() => {
                setPoints(value);
              }}
            >
              {value > 0 ? `+${String(value)}` : `−${String(-value)}`}
            </Chip>
          ))}
        </ChipRow>
        <TextField
          label="What for (optional)"
          autoComplete="off"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        {adjust.isError ? (
          <p role="alert" className="font-semibold text-alert">
            {errorMessage(adjust.error)}
          </p>
        ) : null}
        <div>
          <Button
            disabled={!chosen}
            pending={adjust.isPending}
            onClick={() => {
              if (!chosen) return;
              adjust.mutate(
                { member: chosen.id, points, reason: reason.trim(), name: chosen.name },
                {
                  onSuccess: () => {
                    setReason("");
                  },
                },
              );
            }}
          >
            {points > 0 ? "Give stars" : "Take stars"}
          </Button>
        </div>
      </div>
    </Group>
  );
}
