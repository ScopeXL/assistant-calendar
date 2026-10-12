import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { useRailBlocks } from "../features/usePluginModules";
import { clockSuffix, formatClock, shortDate, zonedParts } from "../lib/dates";
import { useStore } from "../lib/store";
import { useMinute } from "../lib/time";
import { Button } from "../ui/Button";
import { Digits } from "../ui/Digits";
import { LiveStatusButton } from "../ui/LiveStatus";
import { roomHeader } from "./roomHeader";

/**
 * Today, at the header's left (UX §3): the date, the time at glance size (weight 800, digits in
 * fixed boxes so it never jiggles, AM or PM small beside it), then what the plugins put by the
 * clock (the weather).
 */
function HeaderToday() {
  const now = useMinute();
  const day = zonedParts(now).day;
  const time = formatClock(now);
  const suffix = clockSuffix(now);
  const blocks = useRailBlocks();
  return (
    <div className="flex shrink-0 items-center gap-x-4">
      <p className="text-d-body font-semibold whitespace-nowrap">{shortDate(day)}</p>
      <p className="text-d-glance font-extrabold whitespace-nowrap">
        <Digits value={time} spoken={suffix ? `${time} ${suffix}` : time} />
        {suffix ? (
          <span aria-hidden="true" className="ml-1.5 text-d-secondary font-bold">
            {suffix}
          </span>
        ) : null}
      </p>
      {blocks.map((Block, index) => (
        <Block key={index} place="header" />
      ))}
    </div>
  );
}

/**
 * The wall's header (UX §3, ADR 0029): one bar over the board and the Today panel, the full
 * width in portrait. Today at the left; then the room's title and its own controls, handed over
 * through shell/roomHeader; the Today panel's button and, in the top-right corner, the
 * live-updates icon. One row from 104rem of its own width (1920 px at Standard); narrower, the
 * room's title and controls take a second row and the corner stays where it was. Nothing here
 * animates in: it's part of the first paint.
 */
export function Header({
  panelShown,
  onTogglePanel,
}: {
  panelShown: boolean;
  onTogglePanel: () => void;
}) {
  const room = useStore(roomHeader);
  return (
    <header
      data-header=""
      data-surface=""
      className="@container/header flex min-h-[var(--header-h)] shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface px-6 py-2.5"
    >
      <HeaderToday />
      {room ? (
        <div className="order-last flex min-w-0 grow-0 basis-full flex-wrap items-center gap-x-4 gap-y-2 @min-[104rem]/header:order-none @min-[104rem]/header:grow @min-[104rem]/header:basis-0 @min-[104rem]/header:border-l-2 @min-[104rem]/header:border-line @min-[104rem]/header:pl-5">
          {room.back}
          {/* The title over its quiet line: side by side they'd crowd the room's controls off
              the row (the week's span in late September is as long as the title). */}
          <h1 aria-live="polite" className="flex min-w-0 flex-col justify-center">
            <span className="truncate text-d-title leading-[1.1] font-bold">
              {room.notice ?? room.title}
            </span>
            {room.subtitle && !room.notice ? (
              <>
                {" "}
                <span className="truncate text-d-caption leading-tight font-semibold text-ink-soft">
                  {room.subtitle}
                </span>
              </>
            ) : null}
          </h1>
          {room.controls}
        </div>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="portrait:hidden">
          <Button
            variant="secondary"
            icon
            aria-pressed={panelShown}
            onClick={onTogglePanel}
            aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
          >
            {panelShown ? (
              <PanelRightClose aria-hidden="true" className="size-8" />
            ) : (
              <PanelRightOpen aria-hidden="true" className="size-8" />
            )}
          </Button>
        </span>
        <LiveStatusButton />
      </div>
    </header>
  );
}
