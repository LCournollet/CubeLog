import type { TimePrecision } from "@/core/format/time";

/** Mode de chronométrage actif. */
export type TimerMode = "external" | "keyboard" | "manual";

/** Affichage de l'aide débutant. */
export type BeginnerMode = "compact" | "detailed";

/** Taille d'affichage du scramble. */
export type ScrambleSize = "small" | "medium" | "large";

/** Réglages applicatifs persistés (clé "app" dans la table settings). */
export interface AppSettings {
  theme: "dark" | "light";
  timerMode: TimerMode;

  // Audio
  audioDeviceName: string | null;
  audioInvert: boolean;
  /** Seuil du comparateur (fraction de l'enveloppe, 0..1). */
  audioThreshold: number;
  /** Délai anti-rebond entre deux enregistrements (ms). */
  debounceMs: number;
  /** Compensation de latence d'affichage du timer externe (ms). */
  externalLeadMs: number;

  // Inspection WCA
  inspectionEnabled: boolean;
  inspectionSeconds: number;

  // Format des temps
  precision: TimePrecision;
  alwaysMinutes: boolean;

  // Aide débutant
  beginnerEnabled: boolean;
  beginnerMode: BeginnerMode;
  /** En mode détaillé : flèches seules (true) ou flèches + explications (false). */
  beginnerArrowsOnly: boolean;

  // Scramble
  scrambleSize: ScrambleSize;

  // Divers
  soundEnabled: boolean;
  /** Durée de maintien de la barre espace avant d'être "prêt" (mode clavier). */
  holdToStartMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  timerMode: "keyboard",
  audioDeviceName: null,
  audioInvert: false,
  audioThreshold: 0.25,
  debounceMs: 300,
  externalLeadMs: 100,
  inspectionEnabled: false,
  inspectionSeconds: 15,
  precision: 2,
  alwaysMinutes: false,
  beginnerEnabled: true,
  beginnerMode: "detailed",
  beginnerArrowsOnly: false,
  scrambleSize: "large",
  soundEnabled: true,
  holdToStartMs: 350,
};

/** Fusionne des réglages partiels persistés avec les valeurs par défaut. */
export function mergeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<AppSettings>) };
}
