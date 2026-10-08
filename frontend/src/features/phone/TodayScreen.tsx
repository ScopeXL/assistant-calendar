import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { qk } from "../../api/keys";
import { shortDate, zonedParts } from "../../lib/dates";
import { fetchSession } from "../../lib/session";
import { useMinute } from "../../lib/time";
import { Avatar } from "../../ui/Avatar";

/** A phone's Today (UX §5): the date, who's using it, then Up next and the rest of today. */
export function TodayScreen() {
  const now = useMinute();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-32">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-title font-bold">{shortDate(zonedParts(now).day)}</h1>
        <Link
          to="/who"
          search={{ from: "more" }}
          aria-label={
            session?.member ? `Using this phone: ${session.member.name}` : "Who's using this phone?"
          }
          className="press flex size-11 items-center justify-center rounded-full"
        >
          <Avatar member={session?.member ?? null} size="sm" />
        </Link>
      </header>
      <section aria-labelledby="up-next" className="flex flex-col gap-2">
        <h2 id="up-next" className="text-row font-bold">
          Up next
        </h2>
        <p className="text-big font-bold">Nothing on today.</p>
      </section>
    </main>
  );
}
