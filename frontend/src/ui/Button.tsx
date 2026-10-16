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
  primary: "min-h-tap-primary bg-ink text-on-ink active:opacity-85",
  secondary: "min-h-tap border-2 border-line bg-surface text-ink active:bg-wall",
  quiet:
    "min-h-tap text-ink underline decoration-ink-soft/60 decoration-2 underline-offset-4 active:opacity-70",
  danger: "min-h-tap border-2 border-line bg-surface text-alert active:bg-wall",
  "quiet-danger":
    "min-h-tap text-alert underline decoration-alert/40 decoration-2 underline-offset-4 active:opacity-70",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  block?: boolean;
  /** Waiting on the server: the button keeps its label, shows a spinner, and can't be pressed. */
  pending?: boolean;
  /** Only an icon (name it with aria-label): a square at the shell's tap size, no padding. */
  icon?: boolean;
}

function buttonClasses(
  display: boolean,
  variant: Variant,
  block: boolean,
  icon: boolean,
  className: string | undefined,
): string {
  return [
    "press inline-flex items-center justify-center gap-2 font-semibold",
    display ? "rounded-button-d text-d-body" : "rounded-button text-body",
    // Padding is chosen here, never overridden by className: in the built CSS a later utility
    // for the same property wins, whatever the class order.
    icon ? (display ? "size-tap shrink-0" : "size-12 shrink-0") : display ? "px-7" : "px-5",
    "disabled:cursor-not-allowed disabled:opacity-60",
    (display ? DISPLAY : PHONE)[variant],
    block ? "w-full" : "",
    className ?? "",
  ].join(" ");
}

/**
 * A link that looks like a button, for a page on another website (Support Sunroom's Open GitHub):
 * an `<a>`, so the browser opens it itself. A link can't be disabled, so `disabled` takes its
 * address away and dims it, and says so to a screen reader.
 */
export function ButtonLink({
  variant = "primary",
  block = false,
  disabled = false,
  className,
  href,
  children,
  ...props
}: ComponentPropsWithRef<"a"> & { variant?: Variant; block?: boolean; disabled?: boolean }) {
  const display = useShell() === "display";
  return (
    <a
      {...props}
      href={disabled ? undefined : href}
      role={disabled ? "link" : undefined}
      aria-disabled={disabled || undefined}
      className={`${buttonClasses(display, variant, block, false, className)} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {children}
    </a>
  );
}

export function Button({
  variant = "primary",
  block = false,
  pending = false,
  icon = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const display = useShell() === "display";
  const classes = buttonClasses(display, variant, block, icon, className);
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
