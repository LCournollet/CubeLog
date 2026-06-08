/** Précision d'affichage des temps. */
export type TimePrecision = 2 | 3;

export interface TimeFormatOptions {
  /** Nombre de décimales (2 -> 12.34, 3 -> 12.345). Accepte aussi 1 pour les axes. */
  precision?: number;
  /** Force l'affichage des minutes même sous 60s. */
  alwaysMinutes?: boolean;
}

/**
 * Formate une durée en millisecondes vers une chaîne lisible.
 *  - < 60 s : "SS.cc" (ou "SS.ccc")
 *  - >= 60 s : "M:SS.cc"
 *
 * @param ms durée en millisecondes (>= 0)
 */
export function formatTime(
  ms: number,
  options: TimeFormatOptions = {},
): string {
  const { precision = 2, alwaysMinutes = false } = options;
  if (!Number.isFinite(ms) || ms < 0) return "—";

  // Convention speedcubing : on TRONQUE, on n'arrondit jamais.
  // precision 2 -> centièmes (12.648 -> 12.64), precision 3 -> millièmes.
  const factor = Math.pow(10, 3 - precision); // 1->100, 2->10, 3->1
  let t = Math.floor(Math.floor(ms) / factor) * factor;

  const minutes = Math.floor(t / 60_000);
  t -= minutes * 60_000;
  const seconds = Math.floor(t / 1_000);
  const fracMs = t - seconds * 1_000; // 0..999

  const fracStr = String(fracMs).padStart(3, "0").slice(0, precision);

  if (minutes > 0 || alwaysMinutes) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${fracStr}`;
  }
  return `${seconds}.${fracStr}`;
}

/**
 * Formate le temps FINAL d'un solve en tenant compte de la pénalité.
 *  - DNF -> "DNF"
 *  - +2  -> "<temps>+"  (ex. "12.34+")
 */
export function formatSolveTime(
  finalTimeMs: number | null,
  penalty: "none" | "plus2" | "dnf",
  options: TimeFormatOptions = {},
): string {
  if (penalty === "dnf" || finalTimeMs === null) return "DNF";
  const base = formatTime(finalTimeMs, options);
  return penalty === "plus2" ? `${base}+` : base;
}

/**
 * Parse une saisie manuelle de temps vers des millisecondes.
 * Accepte : "12.34", "12.345", "1:23.45", "83.2", "1:02".
 * Retourne null si invalide.
 */
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Format M:SS.cc
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1] as string, 10);
    const seconds = parseInt(colonMatch[2] as string, 10);
    if (seconds >= 60) return null;
    const frac = padFraction(colonMatch[3]);
    return minutes * 60_000 + seconds * 1000 + frac;
  }

  // Format SS.cc
  const plainMatch = trimmed.match(/^(\d+)(?:\.(\d{1,3}))?$/);
  if (plainMatch) {
    const seconds = parseInt(plainMatch[1] as string, 10);
    const frac = padFraction(plainMatch[2]);
    return seconds * 1000 + frac;
  }

  return null;
}

/** Normalise une fraction de secondes ("3" -> 300ms, "34" -> 340ms). */
function padFraction(frac: string | undefined): number {
  if (!frac) return 0;
  return parseInt(frac.padEnd(3, "0").slice(0, 3), 10);
}
