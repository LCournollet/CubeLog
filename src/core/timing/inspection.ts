import type { Penalty } from "../types";

/** Configuration de l'inspection WCA. */
export interface InspectionConfig {
  enabled: boolean;
  /** Durée nominale d'inspection (WCA = 15 s). */
  seconds: number;
  /** Au-delà de seconds, tolérance avant +2 (WCA = 2 s). */
  plus2GraceSeconds: number;
}

export const DEFAULT_INSPECTION: InspectionConfig = {
  enabled: false,
  seconds: 15,
  plus2GraceSeconds: 2,
};

/** Seuils d'alerte visuelle (WCA : 8 s puis 12 s). */
export const INSPECTION_WARNINGS = { first: 8, second: 12 } as const;

/**
 * Détermine la pénalité induite par le temps d'inspection écoulé au moment
 * où le solve démarre, selon les règles WCA :
 *  - <= 15 s : aucune pénalité
 *  - 15 s < t <= 17 s : +2
 *  - > 17 s : DNF
 */
export function inspectionPenalty(
  elapsedMs: number,
  config: InspectionConfig,
): Penalty {
  if (!config.enabled) return "none";
  const limit = config.seconds * 1000;
  const grace = limit + config.plus2GraceSeconds * 1000;
  if (elapsedMs <= limit) return "none";
  if (elapsedMs <= grace) return "plus2";
  return "dnf";
}

/** État visuel de l'inspection pour l'UI (compte à rebours + alerte). */
export interface InspectionView {
  /** Secondes restantes (peut être négatif si dépassement). */
  remaining: number;
  /** Niveau d'alerte courant. */
  warning: "none" | "first" | "second" | "over";
}

/** Calcule l'affichage du compte à rebours d'inspection. */
export function inspectionView(
  elapsedMs: number,
  config: InspectionConfig,
): InspectionView {
  const elapsedSec = elapsedMs / 1000;
  const remaining = config.seconds - elapsedSec;
  let warning: InspectionView["warning"] = "none";
  if (elapsedSec >= config.seconds) warning = "over";
  else if (elapsedSec >= INSPECTION_WARNINGS.second) warning = "second";
  else if (elapsedSec >= INSPECTION_WARNINGS.first) warning = "first";
  return { remaining, warning };
}
