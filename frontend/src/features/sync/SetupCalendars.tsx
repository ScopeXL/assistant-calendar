import { useState } from "react";

import { Button } from "../../ui/Button";
import { AddAccountSheet } from "./AddAccount";
import { useAccounts } from "./data";

/** First run, step 6 (UX §6): Google, iCloud, a calendar address or holidays; each flow comes
 * back here, listing what was added. */
export function SetupCalendars({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();
  return (
    <>
      <p className="text-body text-ink-soft">
        Google, iCloud, a school or team calendar, or your country's holidays. You can add more
        later in Settings, then Calendars & Accounts.
      </p>
      {accounts.length ? (
        <ul aria-label="Added" className="flex flex-col gap-1">
          {accounts.map((account) => (
            <li key={account.id} className="text-body font-semibold">
              {account.label}
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        variant={accounts.length ? "secondary" : "primary"}
        block
        onClick={() => {
          setOpen(true);
        }}
      >
        {accounts.length ? "Add another" : "Add a calendar"}
      </Button>
      <Button variant={accounts.length ? "primary" : "quiet"} block onClick={onDone}>
        {accounts.length ? "Next" : "Skip for now"}
      </Button>
      <AddAccountSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
