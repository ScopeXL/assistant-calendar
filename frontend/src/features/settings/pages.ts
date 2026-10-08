/** Core's Settings pages (UX §4 "Settings (display)", §5 "Settings (phone)"); plugins add
 * their own after Calendars & accounts (SettingsScreens). */
export const SETTINGS_PAGES = [
  { key: "family", title: "Family" },
  { key: "features", title: "Features" },
  { key: "calendars", title: "Calendars & accounts" },
  { key: "display", title: "Display" },
  { key: "household", title: "Household" },
  { key: "devices", title: "Phones & screens" },
  { key: "backup", title: "Backup" },
  { key: "about", title: "About" },
] as const;

export type SettingsPageKey = (typeof SETTINGS_PAGES)[number]["key"];
