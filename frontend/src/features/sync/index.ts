/** The calendar_sync plugin's frontend (PLAN §6.5, §8): Calendars & accounts, and the pill. */
import type { PluginModule } from "../registry";
import { AccountsSection } from "./AccountsSection";
import { SetupCalendars } from "./SetupCalendars";
import { SyncPill } from "./SyncPill";

const module: PluginModule = {
  id: "calendar_sync",
  settings: { accounts: AccountsSection },
  boardPill: SyncPill,
  onboarding: SetupCalendars,
};

export default module;
