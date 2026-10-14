import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { useMembers, type Member } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { uploadPicture } from "../../lib/upload";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { ColorPicker, usedBy } from "../../ui/ColorPicker";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";

type Color = Member["color"];

/**
 * Edit a person (UX §4 Settings → Family): name, parent or child, color (the ones nobody else
 * has first), birthday and photo.
 * Removing someone asks first, because a toast's Undo isn't enough for a whole person; their
 * history stays (they're archived, and Put back is in Family).
 */
export function MemberSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  return (
    <Sheet open={member !== null} title={member ? `Edit ${member.name}` : "Edit"} onClose={onClose}>
      {member ? <MemberForm key={member.id} member={member} onClose={onClose} /> : null}
    </Sheet>
  );
}

function MemberForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const display = useShell() === "display";
  // A photo comes from a phone or a computer; the kitchen screen has no files (ADR 0028).
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const kiosk = session?.device_kind === "kiosk";
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();
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
      <ColorPicker
        name="color"
        value={color}
        onChange={setColor}
        used={usedBy(members, member.id)}
        initial={(name.trim() || member.name).charAt(0).toUpperCase()}
      />
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
        {kiosk ? (
          <p className="text-d-secondary text-ink-soft">
            Add a photo from a phone: More, then Settings, then Family.
          </p>
        ) : (
          <label
            className={`press inline-flex cursor-pointer items-center border-2 border-line bg-surface font-semibold has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
              display
                ? "min-h-tap rounded-button-d px-7 text-d-body"
                : "min-h-11 rounded-button px-4 text-body"
            }`}
          >
            {member.avatar_url ? "Change Photo" : "Add a Photo"}
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
            Remove Photo
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" block pending={save.isPending} disabled={!name.trim()}>
        Save Changes
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
