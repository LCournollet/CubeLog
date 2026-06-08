/**
 * Types du domaine partagés dans toute l'application.
 * Ces types reflètent le schéma SQLite (voir src-tauri/src/db).
 */

/** Type de puzzle. MVP = 3x3, architecture extensible. */
export type PuzzleType =
  | "333"
  | "222"
  | "444"
  | "555"
  | "pyram"
  | "skewb"
  | "minx";

/** Pénalité appliquée à un solve. */
export type Penalty = "none" | "plus2" | "dnf";

/** Origine du temps enregistré. */
export type SolveSource = "external_timer" | "keyboard" | "manual";

/** Statut de cycle de vie d'un solve. */
export type SolveStatus = "normal" | "deleted" | "archived";

/** Une session de chronométrage (regroupe des solves). */
export interface Session {
  id: number;
  name: string;
  puzzle: PuzzleType;
  /** Timestamp unix en millisecondes. */
  createdAt: number;
  /** Nombre de solves "normal" (calculé côté backend, optionnel). */
  solveCount?: number;
}

/** Un solve (résolution chronométrée). */
export interface Solve {
  id: number;
  sessionId: number;
  puzzle: PuzzleType;
  /** Timestamp unix en millisecondes. */
  createdAt: number;
  /** Scramble en notation technique exacte affiché au départ. */
  scramble: string;
  /** Temps brut en millisecondes (avant pénalité). */
  timeMs: number;
  penalty: Penalty;
  /**
   * Temps final en millisecondes après pénalité.
   * `null` si DNF.
   * (Dérivé de timeMs + penalty, stocké pour faciliter les requêtes.)
   */
  finalTimeMs: number | null;
  comment: string | null;
  source: SolveSource;
  status: SolveStatus;
}

/** Données nécessaires pour créer un solve (sans id ni champs dérivés). */
export interface NewSolve {
  sessionId: number;
  puzzle: PuzzleType;
  createdAt: number;
  scramble: string;
  timeMs: number;
  penalty: Penalty;
  source: SolveSource;
  comment?: string | null;
}

/** Métadonnées d'un puzzle (nom lisible, longueur de scramble...). */
export interface PuzzleInfo {
  type: PuzzleType;
  label: string;
  scrambleLength: number;
}

export const PUZZLES: Record<PuzzleType, PuzzleInfo> = {
  "333": { type: "333", label: "3x3x3", scrambleLength: 20 },
  "222": { type: "222", label: "2x2x2", scrambleLength: 11 },
  "444": { type: "444", label: "4x4x4", scrambleLength: 44 },
  "555": { type: "555", label: "5x5x5", scrambleLength: 60 },
  pyram: { type: "pyram", label: "Pyraminx", scrambleLength: 11 },
  skewb: { type: "skewb", label: "Skewb", scrambleLength: 11 },
  minx: { type: "minx", label: "Megaminx", scrambleLength: 70 },
};
