import { House } from "lucide-react";

import type { components } from "../api/schema";

type Member = components["schemas"]["MemberOut"];

const SIZES = {
  xs: "size-7 text-[0.8rem] border-2",
  sm: "size-10 text-body border-[3px]",
  md: "size-12 text-row border-[3px]",
  lg: "size-16 text-d-body border-[3px]",
  xl: "size-[72px] text-d-title border-4",
} as const;

/**
 * A person's avatar (UX §4 "The Who picker"): their photo, or their initial, in a ring of their
 * color. Color is never the only signal: the initial or photo is always there, and the name is
 * written beside it wherever it matters.
 */
export function Avatar({
  member,
  size = "md",
}: {
  member: Pick<Member, "name" | "color" | "avatar_url"> | null;
  size?: keyof typeof SIZES;
}) {
  if (!member) {
    return (
      <span
        aria-hidden="true"
        data-person="everyone"
        className={`inline-flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full border-ink bg-surface text-ink`}
      >
        <House className="size-1/2" strokeWidth={2.25} />
      </span>
    );
  }
  const initial = member.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      data-person={member.color}
      className={`inline-flex ${SIZES[size]} shrink-0 items-center justify-center overflow-hidden rounded-full border-p bg-p font-bold text-on-ink`}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
