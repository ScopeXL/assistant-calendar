import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { useMembers, useSettings, useUpdateSettings, type Member } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { AddPersonRow, type RoleChoice } from "./AddPersonRow";
import { MemberSheet } from "./MemberSheet";
import { Group, Row, Text } from "./parts";

/** Settings → Family (UX §4): the people, the parent PIN and Child-safe editing. */
export function FamilyPage() {
  const display = useShell() === "display";
  const { data: members = [] } = useMembers();
  const { data: archived = [] } = useMembers(true);
  const [changing, setChanging] = useState<Member | null>(null);
  const queryClient = useQueryClient();
  const removed = archived.filter((member) => member.archived);

  const restore = useMutation({
    mutationFn: (member: Member) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/members/{member_id}/restore", {
            params: { path: { member_id: member.id } },
          }),
        ),
      ),
    onSuccess: async (member) => {
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      showToast(`Put back ${member.name}`);
    },
  });

  return (
    <>
      <Group title="People">
        {members.length === 0 ? (
          <div className="py-4">
            <Text soft>Add the people who live here, children included.</Text>
          </div>
        ) : null}
        {members.map((member) => (
          <div
            key={member.id}
            className={`flex items-center gap-4 ${display ? "min-h-20 py-3" : "min-h-16 py-2"}`}
          >
            <Avatar member={member} size={display ? "lg" : "md"} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className={display ? "text-d-body font-semibold" : "text-row font-semibold"}>
                {member.name}
              </span>
              <span
                className={
                  display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                }
              >
                {`${member.role === "kid" ? "Child" : "Parent"}, ${member.color_word}`}
              </span>
            </div>
            <Button
              variant="secondary"
              aria-label={`Change ${member.name}`}
              onClick={() => {
                setChanging(member);
              }}
            >
              Change
            </Button>
          </div>
        ))}
        <AddPerson />
      </Group>
      {removed.length > 0 ? (
        <Group title="Removed People">
          {removed.map((member) => (
            <Row key={member.id} label={member.name}>
              <Button
                variant="secondary"
                pending={restore.isPending}
                onClick={() => {
                  restore.mutate(member);
                }}
              >
                Put back
              </Button>
            </Row>
          ))}
        </Group>
      ) : null}
      <ParentPin />
      <MemberSheet
        member={changing}
        onClose={() => {
          setChanging(null);
        }}
      />
    </>
  );
}

function AddPerson() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: ({ name, role }: { name: string; role: RoleChoice }) =>
      asParent(async () => unwrap(await api.POST("/api/members", { body: { name, role } }))),
    onSuccess: async (member) => {
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      await queryClient.invalidateQueries({ queryKey: qk.session() });
      showToast(`Added ${member.name}`);
    },
  });
  return (
    <div className={display ? "py-6" : "py-4"}>
      <AddPersonRow
        label="Add a person"
        placeholder="Name"
        action="Add"
        pending={add.isPending}
        error={add.isError ? errorMessage(add.error) : null}
        onAdd={(name, role) => add.mutateAsync({ name, role })}
      />
    </div>
  );
}

function ParentPin() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const updateSettings = useUpdateSettings();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");
  const hasPin = settings?.has_pin ?? false;
  // Where the PIN is what made this device a parent (the wall screen, a kid's phone), changing
  // it asks for the current one (PLAN §12.3).
  const needsCurrent =
    hasPin && (session?.device_kind === "kiosk" || session?.is_kid_device === true);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.settings() });
    await queryClient.invalidateQueries({ queryKey: qk.session() });
  };
  const save = useMutation({
    mutationFn: () =>
      asParent(async () => {
        const result = await api.PUT("/api/auth/pin", {
          body: needsCurrent ? { pin, current_pin: current } : { pin },
        });
        if (!result.response.ok) unwrap(result);
      }),
    onSuccess: async () => {
      setEditing(false);
      setPin("");
      setCurrent("");
      await refresh();
      showToast("PIN set");
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      asParent(async () => {
        const result = await api.DELETE("/api/auth/pin");
        if (!result.response.ok) unwrap(result);
      }),
    onSuccess: async () => {
      await refresh();
      showToast("PIN removed");
    },
  });
  const valid = /^\d{4,6}$/.test(pin) && (!needsCurrent || /^\d{4,6}$/.test(current));

  return (
    <Group
      title="Parent PIN"
      note={
        hasPin
          ? "Settings, approvals and changing events on the kitchen screen ask for it."
          : "Set a parent PIN so children can't open Settings on the kitchen screen."
      }
    >
      {editing ? (
        <form
          className={`flex flex-col gap-4 ${display ? "py-6" : "py-4"}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
        >
          {needsCurrent ? (
            <TextField
              label="Current PIN"
              type="password"
              inputMode="numeric"
              layout="numeric"
              autoComplete="off"
              maxLength={6}
              value={current}
              onChange={(event) => {
                setCurrent(event.target.value.replace(/\D/g, ""));
              }}
            />
          ) : null}
          <TextField
            label="New PIN (4 to 6 digits)"
            type="password"
            inputMode="numeric"
            layout="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            error={save.isError ? errorMessage(save.error) : null}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, ""));
            }}
          />
          <div className="flex gap-3">
            <Button type="submit" pending={save.isPending} disabled={!valid}>
              Set PIN
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Row label={hasPin ? "A PIN is set" : "No PIN yet"}>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {hasPin ? "Change PIN" : "Set a PIN"}
          </Button>
          {hasPin ? (
            <Button
              variant="quiet-danger"
              pending={remove.isPending}
              onClick={() => {
                remove.mutate();
              }}
            >
              Remove PIN
            </Button>
          ) : null}
        </Row>
      )}
      <Switch
        label="Child-safe editing"
        hint="Changing or removing events on the kitchen screen asks for the PIN. Adding and checking off never do."
        checked={settings?.kid_safe_editing ?? true}
        onChange={(value) => {
          updateSettings.mutate({ kid_safe_editing: value });
        }}
      />
    </Group>
  );
}
