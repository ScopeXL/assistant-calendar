import type { Member } from "../lib/household";
import { Avatar } from "./Avatar";
import { useShell } from "./shell";

/**
 * The Who picker (UX §4): avatars with their names under them, Everyone (a house mark) first
 * where it fits, then each person in household order. Chosen: an ink ring and the person's tint,
 * with aria-pressed. One person or several (`multiple`); kids-only for asking for a reward. In
 * editors it's a row; "Who did it?" places it beside the box.
 */
export function WhoPicker({
  label,
  members,
  value,
  onChange,
  multiple = false,
  everyone = true,
  kidsOnly = false,
}: {
  /** The group's name for screen readers: "Who", "Who did it?". */
  label: string;
  members: Member[];
  /** The chosen people; empty is Everyone. */
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  everyone?: boolean;
  kidsOnly?: boolean;
}) {
  const display = useShell() === "display";
  const people = kidsOnly ? members.filter((member) => member.role === "kid") : members;
  const option = `press select-fill flex flex-col items-center gap-1 rounded-button p-2 aria-pressed:bg-p-tint aria-pressed:ring-[3px] aria-pressed:ring-ink ${
    display ? "min-w-24" : "min-w-16"
  }`;
  const name = (chosen: boolean) =>
    `${display ? "text-d-secondary" : "text-secondary"} ${chosen ? "font-bold" : "font-semibold"}`;
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap ${display ? "gap-3" : "gap-2"}`}
    >
      {everyone ? (
        <button
          type="button"
          aria-pressed={value.length === 0}
          data-person="everyone"
          onClick={() => {
            onChange([]);
          }}
          className={option}
        >
          <Avatar member={null} size={display ? "lg" : "md"} />
          <span className={name(value.length === 0)}>Everyone</span>
        </button>
      ) : null}
      {people.map((member) => {
        const on = value.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            aria-pressed={on}
            data-person={member.color}
            onClick={() => {
              if (!multiple) onChange([member.id]);
              else onChange(on ? value.filter((id) => id !== member.id) : [...value, member.id]);
            }}
            className={option}
          >
            <Avatar member={member} size={display ? "lg" : "md"} />
            <span className={name(on)}>{member.name}</span>
          </button>
        );
      })}
    </div>
  );
}
