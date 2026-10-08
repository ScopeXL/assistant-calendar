/** Every TanStack Query key in one place. */
export const qk = {
  session: () => ["session"] as const,
  setupStatus: () => ["setup-status"] as const,
  members: (archived = false) => ["members", archived] as const,
  settings: () => ["settings"] as const,
  devices: () => ["devices"] as const,
  diagnostics: () => ["diagnostics"] as const,
  backups: () => ["backups"] as const,
  kioskLayout: () => ["kiosk-layout"] as const,
  plugins: () => ["plugins"] as const,
  pluginSettings: (id: string) => ["plugins", id, "settings"] as const,
  photos: (kind: string) => ["photos", kind] as const,
  allowlist: () => ["network-allowlist"] as const,
};
