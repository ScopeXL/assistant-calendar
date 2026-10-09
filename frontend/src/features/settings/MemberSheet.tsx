import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import type { Member } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { uploadPicture } from "../../lib/upload";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";

type Color = Member["color"];

/** The eight person colors, in their plain words (UX §10), each shown with the initial. */
export const COLORS: { value: Color; word: string }[] = [
  { value: "clay", word: "Red" },
  { value: "olive", word: "Olive" },
  { value: "moss", word: "Green" },
  { value: "sea", word: "Teal" },
  { value: "sky", word: "Blue" },
  { value: "iris", word: "Purple" },
  { value: "berry", word: "Plum" },
  { value: "rose", word: "Pink" },
];

/**
 * Change a person (UX §4 Settings → Family): name, parent or child, color, birthday and photo.
 * Removing someone asks first, because a toast's Undo isn't enough for a whole person; their
 * history stays (they're archived, and Put back is in Family).
 */
export function MemberSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  return (
    <Sheet
      open={member !== null}
      title={member ? `Change ${member.name}` : "Change"}
      onClose={onClose}
    >
      {member ? <MemberForm key={member.id} member={member} onClose={onClose} /> : null}
    </Sheet>
  );
}

function MemberForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<Member["role"]>(member.role);
  const [color, setColor] = useState<Color>(member.color);
  const [birthday, setBirthday] = useState(member.birthday ?? "");
  const [confirming, setConfirming] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  const save = useMutation({
    mutationFn: () =>
      asParent(async () =>
        unwrap(
          await api.PATCH("/api/members/{member_id}", {
            params: { path: { member_id: member.id } },
            body: { name: name.trim(), role, color, birthday: birthday || null },
          }),
        ),
      ),
    onSuccess: async () => {
      await refresh();
      showToast("Changes saved");
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/members/{member_id}/archive", {
            params: { path: { member_id: member.id } },
          }),
        ),
      ),
    onSuccess: async () => {
      await refresh();
      showToast(`Removed ${member.name}`, {
        label: "Undo",
        onAction: () => {
          void api
            .POST("/api/members/{member_id}/restore", {
              params: { path: { member_id: member.id } },
            })
            .then(refresh);
        },
      });
      onClose();
    },
  });

  const photo = useMutation({
    mutationFn: (file: File) =>
      asParent(() => uploadPicture<Member>(`/api/members/${member.id}/avatar`, "PUT", file, 1024)),
    onSuccess: refresh,
  });

  const removePhoto = useMutation({
    mutationFn: () =>
      asParent(async () =>
        unwrap(
          await api.DELETE("/api/members/{member_id}/avatar", {
            params: { path: { member_id: member.id } },
          }),
        ),
      ),
    onSuccess: refresh,
  });

  if (confirming) {
    return (
      <div className="flex flex-col gap-4">
        <p className={display ? "text-d-body" : "text-body"}>
          {`Remove ${member.name} from the household? Their history stays, and you can put them back
          from Family.`}
        </p>
        <Button
          variant="danger"
          block
          pending={remove.isPending}
          onClick={() => {
            remove.mutate();
          }}
        >
          {`Remove ${member.name}`}
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            setConfirming(false);
          }}
        >
          {`Keep ${member.name}`}
        </Button>
      </div>
    );
  }

  const error = save.error ?? photo.error ?? removePhoto.error ?? remove.error;
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
        maxLength={40}
        autoComplete="off"
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Segmented
        label="Parent or child"
        value={role}
        onChange={setRole}
        options={[
          { value: "parent", label: "Parent" },
          { value: "kid", label: "Child" },
        ]}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 font-semibold ${display ? "text-d-body" : "text-body"}`}>
          Color
        </legend>
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
                name="color"
                value={option.value}
                checked={color === option.value}
                onChange={() => {
                  setColor(option.value);
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-p font-bold text-on-ink"
              >
                {(name.trim() || member.name).charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold">{option.word}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        label="Birthday (optional)"
        type="date"
        value={birthday}
        hint="Birthdays show up on the calendar by themselves."
        onChange={(event) => {
          setBirthday(event.target.value);
        }}
      />
      <div className="flex items-center gap-4">
        <Avatar member={{ name: member.name, color, avatar_url: member.avatar_url }} size="lg" />
        {display ? (
          <p className="text-d-secondary text-ink-soft">
            Add a photo from a phone: More, then Settings, then Family.
          </p>
        ) : (
          <label className="press inline-flex min-h-11 cursor-pointer items-center rounded-button border-2 border-line bg-surface px-4 text-body font-semibold">
            {member.avatar_url ? "Change photo" : "Add a photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) photo.mutate(file);
              }}
            />
          </label>
        )}
        {member.avatar_url ? (
          <Button
            variant="quiet"
            onClick={() => {
              removePhoto.mutate();
            }}
          >
            Remove photo
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" block pending={save.isPending} disabled={!name.trim()}>
        Save changes
      </Button>
      <Button
        variant="quiet-danger"
        block
        onClick={() => {
          setConfirming(true);
        }}
      >
        {`Remove ${member.name}`}
      </Button>
    </form>
  );
}
