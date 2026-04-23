/**
 * Apple app bundle paths (locale-independent). Used with `open <path>`.
 * @see https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/MacOSXDirectories/MacOSXDirectories.html
 */
export const MAC_APP_BUNDLES = {
  settings: "/System/Applications/System Settings.app",
  activity: "/System/Applications/Utilities/Activity Monitor.app",
  music: "/System/Applications/Music.app",
  messages: "/System/Applications/Messages.app",
  mail: "/System/Applications/Mail.app",
  calendar: "/System/Applications/Calendar.app",
  notes: "/System/Applications/Notes.app",
  reminders: "/System/Applications/Reminders.app",
  photos: "/System/Applications/Photos.app",
  facetime: "/System/Applications/FaceTime.app",
  calculator: "/System/Applications/Calculator.app",
  preview: "/System/Applications/Preview.app",
  console: "/System/Applications/Utilities/Console.app",
  "disk-utility": "/System/Applications/Utilities/Disk Utility.app",
  "migration-assistant": "/System/Applications/Utilities/Migration Assistant.app",
  /** Xcode when installed from App Store */
  xcode: "/Applications/Xcode.app",
} as const;

export type MacBundleOpenKey = keyof typeof MAC_APP_BUNDLES;

/** Telegram `/open <alias>` → canonical key in {@link MAC_APP_BUNDLES}. */
export const MAC_OPEN_ALIASES: Record<string, string> = {
  "system-settings": "settings",
  systemsettings: "settings",
  preferences: "settings",
  reglages: "settings",
  "réglages": "settings",
  "activity-monitor": "activity",
  activite: "activity",
  moniteur: "activity",
  "disk-utility": "disk-utility",
  "diskutility": "disk-utility",
};

export function resolveMacBundleKey(raw: string): MacBundleOpenKey | undefined {
  const t = raw.toLowerCase().trim().replace(/_/g, "-");
  const mapped = (MAC_OPEN_ALIASES[t] ?? t) as string;
  return mapped in MAC_APP_BUNDLES ? (mapped as MacBundleOpenKey) : undefined;
}
