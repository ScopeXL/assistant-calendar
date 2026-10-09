import { useRef, useState } from "react";

import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { TextField } from "../../ui/TextField";
import { useShell } from "../../ui/shell";

/** How a person is stored: the family reads Child for `kid` (ADR 0028). */
export type RoleChoice = "parent" | "kid";

const ROLES: { value: RoleChoice; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "kid", label: "Child" },
];

/**
 * Add a person in one row (UX §4 Family, §6 the wizard's people step): a name, Parent or Child,
 * and Add. It wraps only where it can't fit; a 390 px phone holds it on one line. After an add
 * the name clears and keeps focus, and the role stays as chosen: two children in a row is
 * common.
 */
export function AddPersonRow({
  label,
  placeholder = label,
  action,
  primary = false,
  autoComplete = "off",
  pending,
  error,
  onAdd,
}: {
  /** The name field's name for a screen reader: "Your name", "Add a person". */
  label: string;
  /** What the empty field says on screen. */
  placeholder?: string;
  /** "Add me" for the first person, "Add" after. */
  action: string;
  primary?: boolean;
  autoComplete?: string;
  pending: boolean;
  error: string | null;
  /** Resolves once the person is added; a refusal keeps the name for another try. */
  onAdd: (name: string, role: RoleChoice) => Promise<unknown>;
}) {
  const display = useShell() === "display";
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleChoice>("parent");
  const field = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const typed = name.trim();
        if (!typed) return;
        void onAdd(typed, role).then(
          () => {
            setName("");
            field.current?.focus();
          },
          () => undefined,
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-20 flex-1">
          <TextField
            ref={field}
            label={label}
            hideLabel
            placeholder={placeholder}
            value={name}
            maxLength={40}
            autoComplete={autoComplete}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <Segmented label="Parent or child" value={role} onChange={setRole} options={ROLES} />
        <Button
          type="submit"
          variant={primary ? "primary" : "secondary"}
          pending={pending}
          disabled={!name.trim()}
        >
          {action}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className={
            display
              ? "text-d-secondary font-semibold text-alert"
              : "text-secondary font-semibold text-alert"
          }
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
