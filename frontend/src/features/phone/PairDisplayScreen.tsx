import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { codeFromHash, normalizeCode } from "../../lib/joinCode";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { TextField } from "../../ui/TextField";

/**
 * Pair a display (UX §5): type the code the wall screen shows (or scan its QR code, which opens
 * /pair#CODE here). The screen moves on by itself once it's paired.
 */
export function PairDisplayScreen() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(() => codeFromHash(window.location.hash) ?? "");
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", "/pair");
  }, []);
  const { data: devices = [] } = useQuery({
    queryKey: qk.devices(),
    queryFn: () => asParent(async () => unwrap(await api.GET("/api/auth/devices"))),
  });
  const pair = useMutation({
    mutationFn: (value: string) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/auth/kiosk/pair", {
            body: { code: value, label: "Kitchen screen" },
          }),
        ),
      ),
    onSuccess: async () => {
      setCode("");
      await queryClient.invalidateQueries({ queryKey: qk.devices() });
      showToast("Kitchen screen paired");
    },
  });
  const valid = normalizeCode(code);
  const screens = devices.filter((device) => device.kind === "kiosk");
  return (
    <Screen title="Pair a Display" back="/more">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) pair.mutate(valid);
        }}
      >
        <TextField
          label="The code on the screen"
          hint="The screen shows a code. Type it here."
          value={code}
          maxLength={10}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          className="text-title font-bold tracking-widest uppercase"
          error={pair.isError ? errorMessage(pair.error) : null}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        <Button type="submit" block pending={pair.isPending} disabled={!valid}>
          Pair
        </Button>
        <p className="text-secondary text-ink-soft">
          No code? On the screen, open Sunroom. A screen that’s already paired shows the calendar.
        </p>
      </form>
      {screens.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-row font-bold">Paired Screens</h2>
          <ul className="divide-y divide-line rounded-chip border border-line bg-surface px-4">
            {screens.map((screen) => (
              <li key={screen.id} className="flex min-h-14 items-center text-body font-semibold">
                {screen.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Screen>
  );
}
