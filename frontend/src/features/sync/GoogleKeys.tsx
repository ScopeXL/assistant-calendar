import { useState } from "react";

import { ApiError, errorMessage } from "../../api/client";
import { usePlugins } from "../../lib/household";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { TextField } from "../../ui/TextField";
import { usePluginSettings } from "../settings/PluginSettingsForm";

/** The settings group this module draws itself, so the generic form leaves its fields out. */
export const GOOGLE_GROUP = "Sign in with Google";
const MASK = "***";

/**
 * Settings → Features → Synced Calendars → Sign in with Google (ADR 0029): one row that says
 * whether Google's app keys are set, with Set up or Change, and a sheet that holds the two
 * fields. They're only for Sign in with Google, so they don't crowd the Features page. A sheet
 * keeps its Save: half-typed keys shouldn't save themselves.
 */
export function GoogleKeysRow() {
  const display = useShell() === "display";
  const { data: plugins = [] } = usePlugins();
  const settings = plugins.find((plugin) => plugin.id === "calendar_sync")?.settings ?? {};
  const savedId = typeof settings.google_client_id === "string" ? settings.google_client_id : "";
  const hasSecret = settings.google_client_secret === MASK;
  const ready = savedId !== "" && hasSecret;
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${
          display ? "min-h-20 py-4" : "min-h-14 py-3"
        }`}
      >
        <div className="flex min-w-0 flex-col">
          <span className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>
            Sign in with Google
          </span>
          <span
            className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
          >
            {ready ? "Keys saved" : "Not set up"}
          </span>
        </div>
        <Button
          variant="secondary"
          aria-label={ready ? "Change Google's keys" : "Set up Sign in with Google"}
          onClick={() => {
            setOpen(true);
          }}
        >
          {ready ? "Change" : "Set up"}
        </Button>
      </div>
      <Sheet
        open={open}
        title="Google App Keys"
        onClose={() => {
          setOpen(false);
        }}
      >
        {open ? (
          <KeysForm
            savedId={savedId}
            hasSecret={hasSecret}
            onDone={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function KeysForm({
  savedId,
  hasSecret,
  onDone,
}: {
  savedId: string;
  hasSecret: boolean;
  onDone: () => void;
}) {
  const display = useShell() === "display";
  const save = usePluginSettings("calendar_sync");
  const [id, setId] = useState(savedId);
  const [secret, setSecret] = useState("");
  // A new secret, or the one already saved (sent back masked, which keeps it).
  const complete = id.trim() !== "" && (secret !== "" || hasSecret);
  const problems = save.error instanceof ApiError ? save.error.problems : [];
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete) return;
        save.mutate(
          { google_client_id: id.trim(), google_client_secret: secret || MASK },
          {
            onSuccess: () => {
              showToast("Keys saved");
              onDone();
            },
          },
        );
      }}
    >
      <p className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}>
        Only for Sign in with Google. Settings → Calendars & Accounts explains it.
      </p>
      <TextField
        label="Google app's client ID"
        value={id}
        maxLength={200}
        autoComplete="off"
        autoCapitalize="none"
        onChange={(event) => {
          setId(event.target.value);
        }}
      />
      <TextField
        label="Google app's client secret"
        type="password"
        layout="password"
        value={secret}
        maxLength={200}
        autoComplete="off"
        hint={hasSecret ? "Saved. Type a new one to replace it." : null}
        placeholder={hasSecret ? "••••••••" : undefined}
        onChange={(event) => {
          setSecret(event.target.value);
        }}
      />
      {save.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {problems.length ? problems.join(" ") : errorMessage(save.error)}
        </p>
      ) : null}
      <Button type="submit" block pending={save.isPending} disabled={!complete}>
        Save keys
      </Button>
      {savedId || hasSecret ? (
        <Button
          variant="quiet-danger"
          block
          onClick={() => {
            // An empty secret clears it; the mask would keep it.
            save.mutate(
              { google_client_id: "", google_client_secret: "" },
              {
                onSuccess: () => {
                  showToast("Removed Google's keys");
                  onDone();
                },
              },
            );
          }}
        >
          Remove keys
        </Button>
      ) : null}
    </form>
  );
}
