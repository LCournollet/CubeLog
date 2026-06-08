/** Résultat d'un calcul de moyenne ou de single. */
export interface StatResult {
  /** Valeur en millisecondes, ou null si DNF / données insuffisantes. */
  value: number | null;
  /** Vrai si le résultat est un DNF (vs simplement indisponible). */
  isDnf: boolean;
}

/** Synthèse statistique complète d'un ensemble de solves. */
export interface SessionStats {
  count: number;
  dnfCount: number;
  /** Taux de DNF entre 0 et 1. */
  dnfRate: number;
  /** Meilleur temps (single) non-DNF. */
  bestSingle: StatResult;
  /** Pire temps (single) non-DNF. */
  worstSingle: StatResult;
  /** Moyenne arithmétique des temps non-DNF. */
  mean: StatResult;
  /** Dernier temps enregistré. */
  lastSingle: StatResult;
  /** Moyennes courantes (sur les N derniers solves). */
  current: Record<AverageSize, StatResult>;
  /** Meilleures moyennes (meilleure fenêtre glissante de taille N). */
  best: Record<AverageSize, StatResult>;
}

/** Tailles de moyennes supportées. */
export type AverageSize = 5 | 12 | 50 | 100;

export const AVERAGE_SIZES: readonly AverageSize[] = [5, 12, 50, 100] as const;
