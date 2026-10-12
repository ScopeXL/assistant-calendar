import { motion, useIsPresent } from "motion/react";
import type { ReactNode, Ref } from "react";

import { LEAVE, useMotionReduced } from "../lib/motion";

/**
 * Something that fades and shrinks away when it's taken off the screen (UX §9 "Chips leave"):
 * a direct child of an AnimatePresence. While it goes it can't be tapped, focused or read out,
 * because it's already gone: only its picture lingers. `stays` leaves at once instead (the
 * now line), and so does everything under Reduce Motion.
 */
export function Leaves({
  ref,
  stays = false,
  className,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  stays?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const present = useIsPresent();
  const reduced = useMotionReduced();
  return (
    <motion.div
      ref={ref}
      inert={!present}
      aria-hidden={present ? undefined : true}
      className={className}
      {...(reduced || stays ? {} : { exit: LEAVE })}
    >
      {children}
    </motion.div>
  );
}
