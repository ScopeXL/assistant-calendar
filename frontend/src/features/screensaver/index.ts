/** The screensaver plugin's frontend (PLAN §6.5, UX §4 "Photos room", "Screensaver", §6
 * "Screensaver in and out"): the screensaver over the idle wall, the Photos room, Photos on
 * phones (add and remove), and Settings → Photos & screensaver. */
import { Images } from "lucide-react";

import type { PluginModule } from "../registry";
import { PhotosRoom } from "./PhotosRoom";
import { PhotosTab } from "./PhotosTab";
import { Saver } from "./Saver";
import { SettingsScreensaver } from "./SettingsScreensaver";

const module: PluginModule = {
  id: "screensaver",
  rooms: [
    {
      key: "photos",
      label: "Photos",
      icon: Images,
      order: 60,
      Display: PhotosRoom,
      Phone: PhotosTab,
    },
  ],
  overlay: Saver,
  settingsPages: [{ key: "screensaver", title: "Photos & Screensaver", Page: SettingsScreensaver }],
};

export default module;
