import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import type { components } from "../../api/schema";
import { signedOutHere } from "../../lib/live";
import { asParent } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { AddPhoneSheet } from "./AddPhoneSheet";
import { Group, Text } from "./parts";

type Device = components["schemas"]["DeviceOut"];

function lastUsed(device: Device): string {
  const days = Math.floor((Date.now() - new Date(device.last_seen_at).getTime()) / 86_400_000);
  if (days <= 0) return "last used today";
  if (days === 1) return "last used yesterday";
  return `last used ${String(days)} days ago`;
}

function signOutLabel(device: Device): string {
  if (device.kind === "kiosk") return device.is_current ? "Unpair this screen" : "Unpair";
  return device.is_current ? "Sign out of this phone" : "Sign out";
}

/** Settings → Phones & screens (UX §4): every signed-in phone and paired screen. */
export function DevicesPage() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const { data: devices = [], error } = useQuery({
    queryKey: qk.devices(),
    queryFn: () => asParent(async () => unwrap(await api.GET("/api/auth/devices"))),
  });
  const [adding, setAdding] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.devices() });

  const signOut = useMutation({
    mutationFn: (device: Device) =>
      asParent(async () => {
        const result = await api.DELETE("/api/auth/devices/{device_id}", {
          params: { path: { device_id: device.id } },
        });
        if (!result.response.ok) unwrap(result);
        return device;
      }),
    onSuccess: async (device) => {
      // The server cleared this device's cookie with it: straight to sign in (or the pair code).
      if (device.is_current) {
        signedOutHere();
        return;
      }
      await refresh();
      showToast(
        device.kind === "kiosk" ? `Unpaired ${device.label}` : `Signed out ${device.label}`,
      );
    },
  });
  const kidPhone = useMutation({
    mutationFn: ({ device, kid }: { device: Device; kid: boolean }) =>
      asParent(async () =>
        unwrap(
          await api.PATCH("/api/auth/devices/{device_id}", {
            params: { path: { device_id: device.id } },
            body: { is_kid_device: kid },
          }),
        ),
      ),
    onSuccess: refresh,
  });

  const screens = devices.filter((device) => device.kind === "kiosk");
  const phones = devices.filter((device) => device.kind === "phone");
  const problem = error ?? signOut.error ?? kidPhone.error;

  const row = (device: Device) => (
    <div
      key={device.id}
      className={`flex flex-wrap items-center gap-4 ${display ? "min-h-20 py-3" : "min-h-16 py-2"}`}
    >
      {device.kind === "kiosk" ? (
        <Monitor aria-hidden="true" className={display ? "size-9" : "size-6"} />
      ) : (
        <Smartphone aria-hidden="true" className={display ? "size-9" : "size-6"} />
      )}
      <div className="flex min-w-0 flex-1 basis-56 flex-col">
        <span className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>
          {device.label}
          {device.is_current ? " (this one)" : ""}
        </span>
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          {[
            device.member_name ? `Used by ${device.member_name}` : null,
            device.is_kid_device ? "a kid’s phone" : null,
            lastUsed(device),
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </div>
      {device.kind === "phone" && session?.has_pin ? (
        <Button
          variant="secondary"
          aria-pressed={device.is_kid_device}
          onClick={() => {
            kidPhone.mutate({ device, kid: !device.is_kid_device });
          }}
        >
          {device.is_kid_device ? "Not a kid’s phone" : "Kid’s phone"}
        </Button>
      ) : null}
      <Button
        variant="secondary"
        onClick={() => {
          signOut.mutate(device);
        }}
      >
        {signOutLabel(device)}
      </Button>
    </div>
  );

  return (
    <>
      <Group title="Screens">
        {screens.length === 0 ? (
          <div className="py-4">
            <Text soft>
              No screen paired yet. Open Sunroom on the kitchen screen and type its code here.
            </Text>
          </div>
        ) : (
          screens.map(row)
        )}
        {!display ? (
          <div className="py-4">
            <Link
              to="/pair"
              className="press inline-flex min-h-11 items-center rounded-button border-2 border-line bg-surface px-5 text-body font-semibold"
            >
              Pair a display
            </Link>
          </div>
        ) : null}
      </Group>
      <Group
        title="Phones"
        note={session?.has_pin ? undefined : "Set a parent PIN in Family to mark a kid’s phone."}
      >
        {phones.map(row)}
        <div className={display ? "py-5" : "py-4"}>
          <Button
            variant="secondary"
            onClick={() => {
              setAdding(true);
            }}
          >
            Add a phone
          </Button>
        </div>
      </Group>
      {problem ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(problem)}
        </p>
      ) : null}
      <AddPhoneSheet
        open={adding}
        onClose={() => {
          setAdding(false);
        }}
      />
    </>
  );
}
