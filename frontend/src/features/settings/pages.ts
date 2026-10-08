/** Settings' pages (UX §4 "Settings (display)", §5 "Settings (phone)"). */
export const SETTINGS_PAGES = [
  { key: "family", title: "Family" },
  { key: "features", title: "Features" },
  { key: "display", title: "Display" },
  { key: "household", title: "Household" },
  { key: "devices", title: "Phones & screens" },
  { key: "backup", title: "Backup" },
  { key: "about", title: "About" },
] as const;

export type SettingsPageKey = (typeof SETTINGS_PAGES)[number]["key"];

export function isSettingsPage(value: string): value is SettingsPageKey {
  return SETTINGS_PAGES.some((page) => page.key === value);
}

export function pageTitle(key: SettingsPageKey): string {
  return SETTINGS_PAGES.find((page) => page.key === key)?.title ?? "Settings";
}
