import type { Solve } from "../types";
import { effectiveTime } from "../solve/penalty";
import type { AverageSize, SessionStats, StatResult } from "./types";
import { AVERAGE_SIZES } from "./types";

/**
 * Module de statistiques. Toutes les fonctions attendent les solves dans
 * l'ordre CHRONOLOGIQUE (index 0 = le plus ancien, dernier = le plus récent).
 *
 * Conventions :
 *  - un DNF a un temps effectif de +Infinity ;
 *  - une moyenne "WCA-like" retire les meilleurs et pires extrêmes, puis
 *    fait la moyenne du reste ;
 *  - une moyenne est DNF si trop de DNF subsistent après le rognage.
 */

const DNF: StatResult = { value: null, isDnf: true };
const NA: StatResult = { value: null, isDnf: false };

/** Nombre d'éléments rognés à chaque extrémité pour une moyenne de taille n. */
export function trimCount(n: number): number {
  return Math.max(1, Math.ceil(n * 0.05));
}

/**
 * Moyenne tronquée "WCA" d'exactement n temps effectifs (Infinity = DNF).
 * Retire `trimCount(n)` meilleurs et autant de pires, moyenne le reste.
 * Renvoie DNF si un DNF subsiste dans l'ensemble conservé.
 */
export function trimmedAverage(effectiveTimes: number[]): StatResult {
  const n = effectiveTimes.length;
  if (n < 3) return NA; // une moyenne tronquée n'a de sens qu'à partir de 3.

  const sorted = [...effectiveTimes].sort((a, b) => a - b);
  const trim = trimCount(n);

  // Après rognage des `trim` pires, s'il reste un Infinity -> DNF.
  const kept = sorted.slice(trim, n - trim);
  if (kept.some((t) => !Number.isFinite(t))) return DNF;

  const sum = kept.reduce((acc, t) => acc + t, 0);
  return { value: sum / kept.length, isDnf: false };
}

/** Moyenne arithmétique simple ; DNF si au moins un DNF. */
export function mean(solves: Solve[]): StatResult {
  if (solves.length === 0) return NA;
  let sum = 0;
  for (const s of solves) {
    const t = effectiveTime(s);
    if (!Number.isFinite(t)) return DNF;
    sum += t;
  }
  return { value: sum / solves.length, isDnf: false };
}

/**
 * Moyenne courante de taille n : moyenne tronquée des n solves les plus récents.
 * NA si moins de n solves.
 */
export function currentAverage(solves: Solve[], n: number): StatResult {
  if (solves.length < n) return NA;
  const window = solves.slice(solves.length - n).map(effectiveTime);
  return trimmedAverage(window);
}

/**
 * Meilleure moyenne de taille n sur toutes les fenêtres glissantes.
 * NA si moins de n solves. Ignore les fenêtres DNF pour trouver la meilleure
 * valeur finie ; si toutes les fenêtres sont DNF, renvoie DNF.
 */
export function bestAverage(solves: Solve[], n: number): StatResult {
  if (solves.length < n) return NA;
  const eff = solves.map(effectiveTime);

  let best: number | null = null;
  let sawDnfWindow = false;
  for (let start = 0; start + n <= eff.length; start++) {
    const res = trimmedAverage(eff.slice(start, start + n));
    if (res.isDnf) {
      sawDnfWindow = true;
      continue;
    }
    if (res.value !== null && (best === null || res.value < best)) {
      best = res.value;
    }
  }
  if (best !== null) return { value: best, isDnf: false };
  return sawDnfWindow ? DNF : NA;
}

/** Meilleur single (plus petit temps fini). NA si aucun solve fini. */
export function bestSingle(solves: Solve[]): StatResult {
  let best: number | null = null;
  for (const s of solves) {
    const t = effectiveTime(s);
    if (Number.isFinite(t) && (best === null || t < best)) best = t;
  }
  return best === null ? NA : { value: best, isDnf: false };
}

/** Pire single non-DNF (plus grand temps fini). NA si aucun solve fini. */
export function worstSingle(solves: Solve[]): StatResult {
  let worst: number | null = null;
  for (const s of solves) {
    const t = effectiveTime(s);
    if (Number.isFinite(t) && (worst === null || t > worst)) worst = t;
  }
  return worst === null ? NA : { value: worst, isDnf: false };
}

/** Dernier single (le plus récent). */
export function lastSingle(solves: Solve[]): StatResult {
  if (solves.length === 0) return NA;
  const last = solves[solves.length - 1] as Solve;
  if (last.penalty === "dnf") return DNF;
  return { value: effectiveTime(last), isDnf: false };
}

/** Calcule la synthèse statistique complète d'une liste de solves chronologiques. */
export function computeSessionStats(solves: Solve[]): SessionStats {
  const dnfCount = solves.filter((s) => s.penalty === "dnf").length;
  const count = solves.length;

  const current = {} as Record<AverageSize, StatResult>;
  const best = {} as Record<AverageSize, StatResult>;
  for (const size of AVERAGE_SIZES) {
    current[size] = currentAverage(solves, size);
    best[size] = bestAverage(solves, size);
  }

  return {
    count,
    dnfCount,
    dnfRate: count === 0 ? 0 : dnfCount / count,
    bestSingle: bestSingle(solves),
    worstSingle: worstSingle(solves),
    mean: mean(solves),
    lastSingle: lastSingle(solves),
    current,
    best,
  };
}
