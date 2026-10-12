import { createLink } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

// The router's Link hands its own className down (the active class, or nothing): it's merged
// after the spread, or it would replace these.
function BackAnchor({ children, className, ...props }: ComponentPropsWithRef<"a">) {
  return (
    <a
      {...props}
      className={`press -ml-2 inline-flex min-h-tap shrink-0 items-center gap-1 rounded-button-d pr-4 pl-2 text-d-body font-semibold ${className ?? ""}`}
    >
      <ChevronLeft aria-hidden="true" className="size-7" />
      {children}
    </a>
  );
}

/** The way back to the room a page belongs to, before its title in the wall's header: "‹ Lists". */
export const HeaderBack = createLink(BackAnchor);

function ButtonAnchor({ className, ...props }: ComponentPropsWithRef<"a">) {
  return (
    <a
      {...props}
      className={`press inline-flex min-h-tap shrink-0 items-center gap-2 rounded-button-d border-2 border-line bg-surface px-6 text-d-body font-semibold ${className ?? ""}`}
    />
  );
}

/** A link in the header that reads as one of its buttons (Stars & Rewards, Saved Meals). */
export const HeaderLink = createLink(ButtonAnchor);
