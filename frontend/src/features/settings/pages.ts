/** Core's Settings pages (UX §4 "Settings (display)", §5 "Settings (phone)"); plugins add
 * their own after Calendars & accounts (SettingsScreens). */
export const SETTINGS_PAGES = [
  // Only on a wall run by Sunroom Screen (ADR 0035), and first there, apart from the household's
  // pages (ADR 0039): SettingsScreens drops it elsewhere.
  { key: "this-screen", title: "This Screen" },
  { key: "family", title: "Family" },
  { key: "features", title: "Features" },
  { key: "calendars", title: "Calendars & Accounts" },
  { key: "display", title: "Display" },
  { key: "household", title: "Household" },
  { key: "devices", title: "Devices" },
  { key: "removed", title: "Recently Removed" },
  { key: "backup", title: "Backup" },
  { key: "support", title: "Support Sunroom" },
  { key: "about", title: "About" },
] as const;

export type SettingsPageKey = (typeof SETTINGS_PAGES)[number]["key"];
