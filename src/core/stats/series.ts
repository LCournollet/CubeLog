import type { Solve } from "../types";
import { effectiveTime } from "../solve/penalty";
import { currentAverage } from "./statistics";

/** Point de la courbe d'évolution des temps. */
export interface TimeSeriesPoint {
  index: number;
  /** Temps single en ms, null si DNF. */
  single: number | null;
  /** Ao5 courante à cet index (ms), null si indisponible/DNF. */
  ao5: number | null;
  /** Ao12 courante à cet index (ms), null si indisponible/DNF. */
  ao12: number | null;
}

/**
 * Construit la série temporelle pour les graphiques d'évolution.
 * `solves` en ordre chronologique (ancien -> récent).
 */
export function buildTimeSeries(solves: Solve[]): TimeSeriesPoint[] {
  return solves.map((s, i) => {
    const t = effectiveTime(s);
    const window = solves.slice(0, i + 1);
    const ao5 = currentAverage(window, 5);
    const ao12 = currentAverage(window, 12);
    return {
      index: i + 1,
      single: Number.isFinite(t) ? t : null,
      ao5: ao5.value,
      ao12: ao12.value,
    };
  });
}

/** Une tranche de l'histogramme de distribution. */
export interface DistributionBin {
  /** Borne basse de la tranche (ms). */
  from: number;
  /** Borne haute de la tranche (ms). */
  to: number;
  /** Libellé court (secondes). */
  label: string;
  count: number;
}

/**
 * Construit un histogramme de distribution des temps (DNF exclus).
 * @param binCount nombre de tranches souhaité (défaut 12)
 */
export function buildDistribution(
  solves: Solve[],
  binCount = 12,
): DistributionBin[] {
  const times = solves
    .map(effectiveTime)
    .filter((t) => Number.isFinite(t)) as number[];
  if (times.length === 0) return [];

  const min = Math.min(...times);
  const max = Math.max(...times);
  if (min === max) {
    return [
      {
        from: min,
        to: max,
        label: (min / 1000).toFixed(1),
        count: times.length,
      },
    ];
  }

  const width = (max - min) / binCount;
  const bins: DistributionBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * width;
    const to = from + width;
    return { from, to, label: (from / 1000).toFixed(1), count: 0 };
  });

  for (const t of times) {
    let idx = Math.floor((t - min) / width);
    if (idx >= binCount) idx = binCount - 1; // le max tombe dans la dernière tranche
    (bins[idx] as DistributionBin).count++;
  }
  return bins;
}
