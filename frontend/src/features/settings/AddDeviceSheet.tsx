/**
 * Add a Device (UX §4 Devices, §6): a one-time code for another phone, tablet or computer to
 * sign in without the household password. A phone or tablet scans the QR code with its camera, a
 * computer opens the address under it, or any of them types the code on its sign-in screen (Use
 * a code from another device). It works once, for 10 minutes.
 */
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { asParent } from "../../lib/parent";
import type { components } from "../../api/schema";
import { Button } from "../../ui/Button";
import { spokenCode } from "../../lib/joinCode";
import { QrCode } from "../../ui/QrCode";
import { Sheet } from "../../ui/Sheet";

type JoinCode = components["schemas"]["JoinCodeOut"];

function useExpired(code: JoinCode | undefined): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!code) return;
    const check = () => {
      setExpired(Date.now() >= new Date(code.expires_at).getTime());
    };
    const timer = setInterval(check, 5_000);
    const first = setTimeout(check, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [code]);
  return expired;
}

function CodeView({ code, onNew }: { code: JoinCode; onNew: () => void }) {
  const expired = useExpired(code);
  if (expired) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body">That code has run out. Codes work for 10 minutes.</p>
        <Button onClick={onNew}>Make a New Code</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-body">
        On the new phone or tablet, open the camera and point it at this code. On a computer, open
        the address under it.
      </p>
      <QrCode value={code.url} label="QR code that signs in another device" />
      <p className="text-secondary break-all text-ink-soft select-all">{code.url}</p>
      <p className="text-body">
        Or, on the new device’s sign-in screen, tap <strong>Use a code from another device</strong>{" "}
        and type:
      </p>
      <p className="text-title font-bold tracking-widest " data-testid="join-code">
        <span aria-hidden="true">{code.display}</span>
        {/* Read out letter by letter, the way someone would type it. */}
        <span className="sr-only">{spokenCode(code.code)}</span>
      </p>
      <p className="text-secondary text-ink-soft">It works once, for the next 10 minutes.</p>
    </div>
  );
}

export function AddDeviceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const make = useMutation({
    mutationFn: () => asParent(async () => unwrap(await api.POST("/api/auth/join-codes"))),
  });
  const { mutate, reset } = make;
  useEffect(() => {
    if (open) mutate();
    else reset();
  }, [open, mutate, reset]);

  return (
    <Sheet
      open={open}
      title="Add a Device"
      onClose={onClose}
      footer={
        <Button block variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {make.data ? (
        <CodeView
          key={make.data.code}
          code={make.data}
          onNew={() => {
            make.mutate();
          }}
        />
      ) : make.isError ? (
        <div className="flex flex-col gap-4">
          <p className="text-body">{errorMessage(make.error)}</p>
          <Button
            onClick={() => {
              make.mutate();
            }}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <p className="text-body text-ink-soft">Making a code…</p>
      )}
    </Sheet>
  );
}
