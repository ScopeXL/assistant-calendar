/** The calendar_sync plugin's frontend (PLAN §6.5, §8): Calendars & accounts and the pill.
 * Google's app keys are asked for inside Sign in with Google (ADR 0030), so the generic
 * Features form is told to leave their group out. */
import type { PluginModule } from "../registry";
import { AccountsSection } from "./AccountsSection";
import { GOOGLE_GROUP } from "./GoogleKeys";
import { SetupCalendars } from "./SetupCalendars";
import { SyncPill } from "./SyncPill";

const module: PluginModule = {
  id: "calendar_sync",
  settings: { accounts: AccountsSection },
  ownSettingGroups: [GOOGLE_GROUP],
  boardPill: SyncPill,
  onboarding: SetupCalendars,
};

export default module;
