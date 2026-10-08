import { displayState } from "../../lib/displayState";
import { useSettings } from "../../lib/household";
import { useStore } from "../../lib/store";
import { WeekBoard } from "./WeekBoard";

/** The Calendar room on the display: the week board, paged and with the panel toggled through
 * the display's shared state, which the idle machine resets (lib/displayState). */
export function WeekBoardRoom() {
  const { weekOffset, panelShown } = useStore(displayState);
  const { data: settings } = useSettings();
  const shown = panelShown ?? settings?.display_show_today_panel ?? true;
  return (
    <WeekBoard
      weekOffset={weekOffset}
      onWeekOffset={(offset) => {
        displayState.set((state) => ({ ...state, weekOffset: offset }));
      }}
      panelShown={shown}
      onTogglePanel={() => {
        displayState.set((state) => ({ ...state, panelShown: !shown }));
      }}
    />
  );
}
