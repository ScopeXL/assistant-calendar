import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, ApiError, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import type { components } from "../../api/schema";
import { useMembers } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Segmented } from "../../ui/Segmented";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { COLORS } from "./MemberSheet";

type Field = components["schemas"]["FieldOut"];
type Values = Record<string, unknown>;
const MASK = "***";

/**
 * A plugin's settings, drawn from its spec (PLAN §6.2): the generic form every plugin gets unless
 * it brings its own section. Secrets are write-only: a set one shows as dots and stays as it is
 * unless typed over.
 */
export function PluginSettingsForm({
  pluginId,
  spec,
  values,
}: {
  pluginId: string;
  spec: Field[];
  values: Values;
}) {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Values>(values);
  const save = useMutation({
    mutationFn: () =>
      asParent(async () =>
        unwrap(
          await api.PUT("/api/plugins/{plugin_id}/settings", {
            params: { path: { plugin_id: pluginId } },
            body: { values: draft },
          }),
        ),
      ),
    onSuccess: async (saved) => {
      setDraft(saved);
      await queryClient.invalidateQueries({ queryKey: qk.plugins() });
      showToast("Changes saved");
    },
  });
  const problems = save.error instanceof ApiError ? save.error.problems : [];
  const set = (key: string, value: unknown) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  return (
    <form
      className={`flex flex-col ${display ? "gap-6 py-6" : "gap-4 py-4"}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {spec.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={draft[field.key]}
          onChange={(value) => {
            set(field.key, value);
          }}
        />
      ))}
      {save.isError ? (
        <div role="alert" className="font-semibold text-alert">
          {problems.length ? (
            <ul className="list-disc pl-6">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : (
            errorMessage(save.error)
          )}
        </div>
      ) : null}
      <div>
        <Button type="submit" pending={save.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { data: members = [] } = useMembers();
  const display = useShell() === "display";
  // A group's name reads like a field's label (ui/TextField): the shell's body size.
  const groupLabel = `${display ? "text-d-body" : "text-body"} font-semibold`;
  const hint = field.help || null;
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";
  switch (field.type) {
    case "bool":
      return (
        <Switch
          label={field.label}
          hint={field.help}
          checked={value === true}
          onChange={onChange}
        />
      );
    case "int":
    case "float":
    case "percent":
      return (
        <TextField
          label={field.unit ? `${field.label} (${field.unit})` : field.label}
          hint={hint}
          inputMode="decimal"
          layout="numeric"
          value={text}
          onChange={(event) => {
            onChange(event.target.value === "" ? null : event.target.value);
          }}
        />
      );
    case "secret":
      return (
        <TextField
          label={field.label}
          hint={value === MASK ? "Saved. Type a new one to replace it." : hint}
          type="password"
          layout="password"
          autoComplete="off"
          value={value === MASK ? "" : text}
          placeholder={value === MASK ? "••••••••" : undefined}
          onChange={(event) => {
            onChange(event.target.value === "" ? MASK : event.target.value);
          }}
        />
      );
    case "choice": {
      const choices = field.choices ?? [];
      const labels = field.choice_labels ?? choices;
      // Side by side only when the words are short enough to fit a phone ("Light, Dark,
      // Auto"); longer ones ("After 3 days", "30 seconds") wrap as chips.
      const words = choices.reduce(
        (sum, choice, index) => sum + (labels[index] ?? choice).length,
        0,
      );
      if (choices.length <= 4 && words <= 24) {
        return (
          <div className="flex flex-col gap-2">
            <span className={groupLabel}>{field.label}</span>
            <Segmented
              label={field.label}
              value={text}
              onChange={onChange}
              options={choices.map((choice, index) => ({
                value: choice,
                label: labels[index] ?? choice,
              }))}
            />
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <span className={groupLabel}>{field.label}</span>
          <ChipRow label={field.label}>
            {choices.map((choice, index) => (
              <Chip
                key={choice}
                on={text === choice}
                onClick={() => {
                  onChange(choice);
                }}
              >
                {labels[index] ?? choice}
              </Chip>
            ))}
          </ChipRow>
        </div>
      );
    }
    case "multichoice": {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      const choices = field.choices ?? [];
      const labels = field.choice_labels ?? choices;
      return (
        <div className="flex flex-col gap-2">
          <span className={groupLabel}>{field.label}</span>
          <ChipRow label={field.label}>
            {choices.map((choice, index) => (
              <Chip
                key={choice}
                on={chosen.includes(choice)}
                onClick={() => {
                  onChange(
                    chosen.includes(choice)
                      ? chosen.filter((c) => c !== choice)
                      : [...chosen, choice],
                  );
                }}
              >
                {labels[index] ?? choice}
              </Chip>
            ))}
          </ChipRow>
        </div>
      );
    }
    case "color":
      return (
        <div className="flex flex-col gap-2">
          <span className={groupLabel}>{field.label}</span>
          <ChipRow label={field.label}>
            {COLORS.map((color) => (
              <Chip
                key={color.value}
                on={text === color.value}
                onClick={() => {
                  onChange(color.value);
                }}
              >
                {color.word}
              </Chip>
            ))}
          </ChipRow>
        </div>
      );
    case "member":
      return (
        <div className="flex flex-col gap-2">
          <span className={groupLabel}>{field.label}</span>
          <ChipRow label={field.label}>
            {members.map((member) => (
              <Chip
                key={member.id}
                on={text === member.id}
                onClick={() => {
                  onChange(member.id);
                }}
              >
                {member.name}
              </Chip>
            ))}
          </ChipRow>
        </div>
      );
    case "time":
    case "date":
      return (
        <TextField
          label={field.label}
          hint={hint}
          type={field.type}
          value={text}
          onChange={(event) => {
            onChange(event.target.value || null);
          }}
        />
      );
    case "text":
    case "json":
      return (
        <TextField
          label={field.label}
          hint={hint}
          value={field.type === "json" && typeof value === "object" ? JSON.stringify(value) : text}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      );
    default:
      return (
        <TextField
          label={field.label}
          hint={hint}
          value={text}
          maxLength={field.max_length ?? undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      );
  }
}
