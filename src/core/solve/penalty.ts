import type { Penalty, Solve } from "../types";

/** Pénalité +2 en millisecondes. */
export const PLUS_2_MS = 2000;

/**
 * Calcule le temps final (ms) d'un solve à partir du temps brut et de la pénalité.
 *  - none  -> temps brut
 *  - plus2 -> temps brut + 2000 ms
 *  - dnf   -> null (compte comme l'infini dans les classements)
 */
export function computeFinalTime(
  rawTimeMs: number,
  penalty: Penalty,
): number | null {
  switch (penalty) {
    case "none":
      return rawTimeMs;
    case "plus2":
      return rawTimeMs + PLUS_2_MS;
    case "dnf":
      return null;
  }
}

/**
 * Valeur effective d'un solve pour les calculs/tri.
 * DNF -> +Infinity (toujours pire que n'importe quel temps fini).
 */
export function effectiveTime(solve: Pick<Solve, "finalTimeMs" | "penalty">): number {
  if (solve.penalty === "dnf" || solve.finalTimeMs === null) {
    return Number.POSITIVE_INFINITY;
  }
  return solve.finalTimeMs;
}

/** Indique si un solve est un DNF. */
export function isDnf(solve: Pick<Solve, "penalty">): boolean {
  return solve.penalty === "dnf";
}

/** Renvoie un nouveau solve avec la pénalité modifiée et le temps final recalculé. */
export function withPenalty<T extends Pick<Solve, "timeMs" | "penalty" | "finalTimeMs">>(
  solve: T,
  penalty: Penalty,
): T {
  return {
    ...solve,
    penalty,
    finalTimeMs: computeFinalTime(solve.timeMs, penalty),
  };
}
