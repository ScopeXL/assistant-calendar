/** The calendar_sync plugin's frontend (PLAN §6.5, §8): Calendars & accounts. An account that
 * stopped working is reported by the server's problems hook, in Needs Attention (ADR 0034).
 * Google's app keys are asked for inside Sign in with Google (ADR 0030), so the generic
 * Features form is told to leave their group out. */
import type { PluginModule } from "../registry";
import { AccountsSection } from "./AccountsSection";
import { GOOGLE_GROUP } from "./GoogleKeys";
import { SetupCalendars } from "./SetupCalendars";

const module: PluginModule = {
  id: "calendar_sync",
  settings: { accounts: AccountsSection },
  ownSettingGroups: [GOOGLE_GROUP],
  onboarding: SetupCalendars,
};

export default module;
