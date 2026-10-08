/** The weather plugin's frontend (PLAN §6.5, UX §3 "the rail block", §4 "Screensaver"): the
 * weather by the clock, each day's sky on the board, the screensaver's corner, and the
 * household's place (first run, and Settings → Household → Location). */
import type { PluginModule } from "../registry";
import { LocationSettings, PlaceOnboarding } from "./PlaceSearch";
import { WeatherBlock, WeatherDayMark, WeatherSaverCorner } from "./WeatherBlock";

const module: PluginModule = {
  id: "weather",
  railBlock: WeatherBlock,
  dayHeader: WeatherDayMark,
  saverCorner: WeatherSaverCorner,
  settings: { household: LocationSettings },
  onboarding: PlaceOnboarding,
};

export default module;
