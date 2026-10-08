import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

import { useShell } from "./shell";

type Variant = "primary" | "secondary" | "quiet" | "danger" | "quiet-danger";

// UX §1 tap targets: primary 64 px on the display and 48 on phones; every other button 56 / 44.
const PHONE: Record<Variant, string> = {
  primary: "min-h-12 bg-ink text-on-ink active:opacity-85",
  secondary: "min-h-11 border-2 border-line bg-surface text-ink active:bg-wall",
  quiet:
    "min-h-11 text-ink underline decoration-ink-soft/60 decoration-2 underline-offset-4 active:opacity-70",
  danger: "min-h-11 border-2 border-line bg-surface text-alert active:bg-wall",
  "quiet-danger":
    "min-h-11 text-alert underline decoration-alert/40 decoration-2 underline-offset-4 active:opacity-70",
};
const DISPLAY: Record<Variant, string> = {
  primary: "min-h-16 bg-ink text-on-ink active:opacity-85",
  secondary: "min-h-14 border-2 border-line bg-surface text-ink active:bg-wall",
  quiet:
    "min-h-14 text-ink underline decoration-ink-soft/60 decoration-2 underline-offset-4 active:opacity-70",
  danger: "min-h-14 border-2 border-line bg-surface text-alert active:bg-wall",
  "quiet-danger":
    "min-h-14 text-alert underline decoration-alert/40 decoration-2 underline-offset-4 active:opacity-70",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  block?: boolean;
  /** Waiting on the server: the button keeps its label, shows a spinner, and can't be pressed. */
  pending?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  pending = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const display = useShell() === "display";
  const classes = [
    "press inline-flex items-center justify-center gap-2 font-semibold",
    display ? "rounded-button-d px-7 text-d-body" : "rounded-button px-5 text-body",
    "disabled:cursor-not-allowed disabled:opacity-60",
    (display ? DISPLAY : PHONE)[variant],
    block ? "w-full" : "",
    className ?? "",
  ].join(" ");
  return (
    <button
      type="button"
      className={classes}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className={`shrink-0 animate-spin ${display ? "size-7" : "size-5"}`}
        />
      ) : null}
      {children}
    </button>
  );
}
