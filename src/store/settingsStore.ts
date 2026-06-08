import { create } from "zustand";

import { getSettings, setSetting } from "@/api/commands";
import type { AppSettings } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings } from "./settings";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const SETTINGS_KEY = "app";

/** Store des réglages, persistés en SQLite sous une clé JSON unique. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const all = await getSettings();
      const rawJson = all[SETTINGS_KEY];
      const raw = rawJson ? JSON.parse(rawJson) : {};
      set({ settings: mergeSettings(raw), loaded: true });
    } catch {
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await setSetting(SETTINGS_KEY, JSON.stringify(next));
  },
}));
