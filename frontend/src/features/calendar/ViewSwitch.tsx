import { Calendar1, CalendarDays, CalendarRange, ChevronDown, Users } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { BoardView } from "../../lib/displayState";
import { Button } from "../../ui/Button";
import { IconSegmented, type IconSegmentOption } from "../../ui/Segmented";

export type SwitchableView = Exclude<BoardView, "today">;

export const VIEWS: readonly IconSegmentOption<SwitchableView>[] = [
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "day", label: "Day", icon: Calendar1 },
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "people", label: "People", icon: Users },
];

/**
 * The board's views in the wall's header (UX §3, ADR 0029): four icons with the chosen one's
 * word beside it while the header has room (64rem of its own width), a **View** button with a
 * menu when it doesn't. Either way the current view is written out. Only one form is drawn at a
 * time (the header's container decides), so a button named "Day" is never there twice.
 */
export function ViewSwitch({
  view,
  onView,
}: {
  view: SwitchableView;
  onView: (view: SwitchableView) => void;
}) {
  return (
    <>
      <div className="hidden @min-[64rem]/header:block">
        <IconSegmented label="View" options={VIEWS} value={view} onChange={onView} showChosen />
      </div>
      <div className="@min-[64rem]/header:hidden">
        <ViewMenu view={view} onView={onView} />
      </div>
    </>
  );
}

/** The narrow form: "View: Week" opens the four views as a menu of radio items. */
function ViewMenu({
  view,
  onView,
}: {
  view: SwitchableView;
  onView: (view: SwitchableView) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = VIEWS.find((option) => option.value === view) ?? VIEWS[0];
  const CurrentIcon = current?.icon ?? CalendarRange;

  const items = () =>
    Array.from(box.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  // Opening puts focus on the view that's on; a press anywhere else closes the menu.
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(true);
      return;
    }
    const rows = items();
    const at = rows.findIndex((row) => row === document.activeElement);
    const to =
      event.key === "ArrowDown"
        ? (at + 1) % rows.length
        : event.key === "ArrowUp"
          ? (at - 1 + rows.length) % rows.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : -1;
    if (to < 0) return;
    event.preventDefault();
    rows[to]?.focus();
  };

  return (
    <div ref={box} className="relative" onKeyDown={onKeyDown}>
      <Button
        ref={button}
        variant="secondary"
        aria-label={`View: ${current?.label ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <CurrentIcon aria-hidden="true" className="size-8" />
        {current?.label}
        <ChevronDown aria-hidden="true" className="size-7 text-ink-soft" />
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="View"
          data-segmented=""
          className="rise-in absolute top-full right-0 z-50 mt-2 flex min-w-64 flex-col gap-1 rounded-panel border-2 border-line bg-surface p-2 shadow-[0_8px_32px_rgb(0_0_0/0.18)]"
        >
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={value === view}
              onClick={() => {
                onView(value);
                close(true);
              }}
              className="press-row flex min-h-tap items-center gap-3 rounded-button-d px-4 text-left text-d-body font-semibold aria-checked:bg-ink aria-checked:text-on-ink"
            >
              <Icon aria-hidden="true" className="size-8 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
