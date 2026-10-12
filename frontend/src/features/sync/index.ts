/** The calendar_sync plugin's frontend (PLAN §6.5, §8): Calendars & accounts, the pill, and
 * Google's app keys on the Features page. */
import type { PluginModule } from "../registry";
import { AccountsSection } from "./AccountsSection";
import { GOOGLE_GROUP, GoogleKeysRow } from "./GoogleKeys";
import { SetupCalendars } from "./SetupCalendars";
import { SyncPill } from "./SyncPill";

const module: PluginModule = {
  id: "calendar_sync",
  settings: { accounts: AccountsSection, features: GoogleKeysRow },
  ownSettingGroups: [GOOGLE_GROUP],
  boardPill: SyncPill,
  onboarding: SetupCalendars,
};

export default module;
