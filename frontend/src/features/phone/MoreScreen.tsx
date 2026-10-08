import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Info,
  MonitorSmartphone,
  Settings,
  Smartphone,
  UserRound,
} from "lucide-react";

import { qk } from "../../api/keys";
import { isStandalone } from "../../lib/platform";
import { fetchSession } from "../../lib/session";
import { Screen } from "../../ui/Screen";

/** More (UX §5): the rooms not in the tab bar (with plugins, M2+), then everything else. */
export function MoreScreen() {
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const rowClass = "press-row flex min-h-14 items-center gap-3 px-4 text-row font-semibold";
  return (
    <Screen title="More">
      <ul className="divide-y divide-line rounded-chip border border-line bg-surface">
        <li>
          <Link to="/settings" className={rowClass}>
            <Settings aria-hidden="true" />
            <span className="flex-1">Settings</span>
            <ChevronRight aria-hidden="true" className="text-ink-soft" />
          </Link>
        </li>
        <li>
          <Link to="/who" search={{ from: "more" }} className={rowClass}>
            <UserRound aria-hidden="true" />
            <span className="flex flex-1 flex-col">
              Who’s using this
              <span className="text-secondary font-normal text-ink-soft">
                {session?.member ? session.member.name : "Nobody picked"}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="text-ink-soft" />
          </Link>
        </li>
        <li>
          <Link to="/pair" className={rowClass}>
            <MonitorSmartphone aria-hidden="true" />
            <span className="flex-1">Pair a display</span>
            <ChevronRight aria-hidden="true" className="text-ink-soft" />
          </Link>
        </li>
        {!isStandalone() ? (
          <li>
            <Link to="/install" search={{ from: "more" }} className={rowClass}>
              <Smartphone aria-hidden="true" />
              <span className="flex-1">Install the app</span>
              <ChevronRight aria-hidden="true" className="text-ink-soft" />
            </Link>
          </li>
        ) : null}
        <li>
          <Link to="/settings/$page" params={{ page: "about" }} className={rowClass}>
            <Info aria-hidden="true" />
            <span className="flex-1">About</span>
            <ChevronRight aria-hidden="true" className="text-ink-soft" />
          </Link>
        </li>
      </ul>
    </Screen>
  );
}
