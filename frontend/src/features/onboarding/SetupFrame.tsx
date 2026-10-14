import { Check, CircleCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Brand } from "../../ui/Brand";

/** The six steps of first run, in order (UX §6), as the list beside the form names them. */
export const SETUP_STEPS = [
  { key: "password", name: "Household password" },
  { key: "household", name: "Your household" },
  { key: "place", name: "Where’s home" },
  { key: "people", name: "Who lives here" },
  { key: "pin", name: "A parent PIN" },
  { key: "calendars", name: "Your calendars" },
] as const;
export type FramedStep = (typeof SETUP_STEPS)[number]["key"];

// How many steps this page has shown: the first paints still, the ones after it rise in.
let framesShown = 0;

function useRiseIn(): boolean {
  const [rise] = useState(() => framesShown > 0);
  useEffect(() => {
    framesShown += 1;
  }, []);
  return rise;
}

/**
 * A setup step (UX §6, ADR 0032), laid out like Pair This Screen rather than a narrow column at
 * the top of a wide window. From 1024 px a centred card: the brand, how long it takes and the
 * six steps listed at the left (done ones checked, the current one marked), the step's title,
 * lead and form at the right, both centred in the window. On a phone, one column: the brand row
 * with "2 of 6", a six-segment bar for how far along it is, then the step. The list shows the
 * way; the steps' own Back buttons walk it.
 */
export function SetupFrame({
  step,
  title,
  lead,
  children,
}: {
  step: FramedStep;
  title: string;
  /** What the step is for, under its title. */
  lead?: ReactNode;
  children: ReactNode;
}) {
  const at = SETUP_STEPS.findIndex((one) => one.key === step);
  const rise = useRiseIn();
  return (
    <main className="min-h-dvh bg-wall">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+32px)] pb-12 lg:grid lg:grid-cols-[20rem_1fr] lg:content-center lg:gap-12 lg:py-12">
        <aside className="hidden lg:flex lg:flex-col lg:gap-6 lg:self-center">
          <Brand size="entry" />
          <p className="text-secondary text-ink-soft">
            About three minutes. Everything can be changed later in Settings.
          </p>
          <ol aria-label="Setup steps" className="flex flex-col">
            {SETUP_STEPS.map((one, index) => {
              const done = index < at;
              const current = index === at;
              return (
                <li
                  key={one.key}
                  aria-current={current ? "step" : undefined}
                  className="flex min-h-12 items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-secondary font-bold ${
                      done || current ? "bg-ink text-on-ink" : "border-2 border-line text-ink-soft"
                    }`}
                  >
                    {done ? <Check className="size-5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span
                    className={
                      current ? "text-body font-bold" : "text-body font-semibold text-ink-soft"
                    }
                  >
                    {done ? <span className="sr-only">Done: </span> : null}
                    {one.name}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="mb-8 flex flex-col gap-4 lg:hidden">
          <div className="flex items-center gap-3">
            <Brand size="line" />
            <span className="ml-auto text-secondary text-ink-soft">{`${String(at + 1)} of 6`}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Setup"
            aria-valuemin={1}
            aria-valuemax={SETUP_STEPS.length}
            aria-valuenow={at + 1}
            aria-valuetext={`Step ${String(at + 1)} of 6: ${SETUP_STEPS[at]?.name ?? ""}`}
            className="flex gap-1"
          >
            {SETUP_STEPS.map((one, index) => (
              <span
                key={one.key}
                className={`h-1.5 flex-1 rounded-full ${index <= at ? "bg-ink" : "bg-line"}`}
              />
            ))}
          </div>
        </div>
        <div
          className={`flex w-full max-w-xl flex-col gap-5 lg:self-center ${rise ? "rise-in" : ""}`}
        >
          <h1 className="text-title font-bold lg:text-d-title">{title}</h1>
          {lead ? <p className="text-body text-ink-soft lg:text-d-secondary">{lead}</p> : null}
          {children}
        </div>
      </div>
    </main>
  );
}

/** A step's buttons, in one row from 1024 px: the way back (or a quiet "Later") at the left, the
 * step's main button at the right. On a phone the main button is first, full width. */
export function StepActions({ back, children }: { back?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-2 lg:flex-row-reverse lg:items-center lg:justify-between lg:[&>*]:w-auto lg:[&>*:first-child]:min-w-40">
      {children}
      {back}
    </div>
  );
}

/** Welcome and You're Set: one centred column with the brand, like Pair This Screen. */
export function SetupEnd({
  title,
  done = false,
  children,
}: {
  title: string;
  /** You're Set: a check in the sun's color over the title. */
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-wall">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <Brand size="entry" />
        {done ? <CircleCheck aria-hidden="true" className="size-16 fill-sun text-on-sun" /> : null}
        <h1 className="text-title font-bold lg:text-d-glance">{title}</h1>
        <div className="flex w-full flex-col items-center gap-5 text-body lg:text-d-body">
          {children}
        </div>
      </div>
    </main>
  );
}
