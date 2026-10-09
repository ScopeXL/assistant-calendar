/**
 * Where a scanned Add-a-phone QR code lands: `/join#7K4M9X`. The code rides in the fragment,
 * so it never reaches the server's or a proxy's logs. On an iPhone in Safari, the home-screen
 * app keeps its own sign-in, so this suggests installing first and typing the code there
 * (UX §5.1); signing in right here in Safari stays one tap away.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { errorMessage } from "../../api/client";
import { codeFromHash, displayCode, spokenCode } from "../../lib/joinCode";
import { isIOS, isStandalone } from "../../lib/platform";
import { SunMark } from "../../ui/SunMark";
import { Button } from "../../ui/Button";
import { useJoinWithCode } from "./useJoin";

function Code({ code }: { code: string }) {
  return (
    <p className="my-4 text-center text-title font-bold tracking-widest ">
      <span aria-hidden="true">{displayCode(code)}</span>
      <span className="sr-only">{spokenCode(code)}</span>
    </p>
  );
}

export function JoinScreen() {
  const navigate = useNavigate();
  const [code] = useState(() => codeFromHash(window.location.hash));
  const join = useJoinWithCode();
  const installFirst = isIOS() && !isStandalone();
  useEffect(() => {
    // Keep the code out of the history list once it's read.
    window.history.replaceState(window.history.state, "", "/join");
  }, []);

  if (!code) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+48px)] pb-12">
        <SunMark className="mb-6 size-16" />
        <h1 className="mb-3 text-title font-bold">That Link Is Missing Its Code</h1>
        <p className="mb-6 text-body text-ink-soft">
          Scan the QR code again, or type the code on the sign-in screen.
        </p>
        <Link
          to="/sign-in"
          className={`inline-flex min-h-11 items-center text-body font-semibold text-ink underline decoration-ink-soft/60 decoration-2 underline-offset-4`}
        >
          Go to sign in
        </Link>
      </main>
    );
  }

  const signInHere = (
    <Button
      block
      variant={installFirst ? "quiet" : "primary"}
      pending={join.isPending}
      onClick={() => {
        join.mutate(code);
      }}
    >
      {join.isPending
        ? "Signing in…"
        : installFirst
          ? "Sign in here in Safari instead"
          : "Sign in on this phone"}
    </Button>
  );

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+48px)] pb-12">
      <SunMark className="mb-6 size-16" />
      {installFirst ? (
        <>
          <h1 className="mb-3 text-title font-bold">Put Sunroom on Your Home Screen First</h1>
          <p className="text-body text-ink-soft">
            On iPhone, the home-screen app keeps its own sign-in. Once it’s there, open it, tap{" "}
            <strong>Use a code from another phone</strong>, and type:
          </p>
          <Code code={code} />
          <p className="mb-6 text-secondary text-ink-soft">
            The code works once, for 10 minutes. The other phone shows it too.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              block
              onClick={() => {
                void navigate({ to: "/install", search: {} });
              }}
            >
              Show me how
            </Button>
            {signInHere}
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-3 text-title font-bold">Sign in with a Code</h1>
          <p className="text-body text-ink-soft">
            Another phone made this code to add this one to Sunroom:
          </p>
          <Code code={code} />
          {signInHere}
        </>
      )}
      <p role="alert" className="mt-4 min-h-7 text-secondary font-semibold text-alert">
        {join.isError ? errorMessage(join.error) : null}
      </p>
      {join.isError ? (
        <Link
          to="/sign-in"
          className={`inline-flex min-h-11 items-center text-body font-semibold text-ink underline decoration-ink-soft/60 decoration-2 underline-offset-4`}
        >
          Sign in with the password instead
        </Link>
      ) : null}
    </main>
  );
}
