import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

import { useShell } from "./shell";

/**
 * A native select at the shell's size (UX §1): 64 px tall with 24 px type on the wall screen,
 * 48 px with 16 px type on phones. Its look is reset, so Safari honours the height, and it draws
 * its own chevron.
 */
export function Select({ className, children, ...props }: ComponentPropsWithRef<"select">) {
  const display = useShell() === "display";
  return (
    <div className="relative flex">
      <select
        className={`w-full min-w-0 appearance-none rounded-button border-2 border-line bg-surface text-ink ${
          display ? "min-h-16 pr-14 pl-4 text-d-body" : "min-h-12 pr-10 pl-3 text-body"
        } ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-soft ${
          display ? "right-4 size-7" : "right-3 size-5"
        }`}
      />
    </div>
  );
}
