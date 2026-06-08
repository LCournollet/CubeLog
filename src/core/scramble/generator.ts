import type { Face, Modifier, Move, Rng } from "./types";
import type { PuzzleType } from "../types";
import { PUZZLES } from "../types";
import { FACES, AXIS } from "./moves";

const MODIFIERS: readonly Modifier[] = ["", "'", "2"] as const;

/** Sélectionne un élément aléatoire d'un tableau via le Rng fourni. */
function pick<T>(arr: readonly T[], rng: Rng): T {
  const i = Math.floor(rng() * arr.length);
  // Garde-fou : rng() peut théoriquement renvoyer 1 - epsilon arrondi.
  return arr[Math.min(i, arr.length - 1)] as T;
}

/**
 * Génère un scramble de mouvements aléatoires pour un cube à faces (3x3, etc.)
 * avec les contraintes anti-redondance classiques :
 *  - jamais deux mouvements de suite sur la même face,
 *  - jamais un mouvement sur le même axe que les DEUX précédents
 *    (évite les séquences type "R L R" qui sont réductibles).
 *
 * Ce sont des scrambles "random-move" (et non random-state/WCA), ce qui est
 * suffisant et honnête pour un MVP. L'architecture permet de brancher un
 * générateur random-state plus tard sans changer l'API.
 *
 * @param length nombre de mouvements
 * @param rng    source d'aléa injectable (défaut Math.random) pour les tests
 */
export function generateMoves(length: number, rng: Rng = Math.random): Move[] {
  const moves: Move[] = [];
  let prevFace: Face | null = null;
  let prevPrevFace: Face | null = null;

  for (let i = 0; i < length; i++) {
    let face: Face;
    // Rejet par échantillonnage : contraintes simples, convergence immédiate.
    do {
      face = pick(FACES, rng);
    } while (!isFaceAllowed(face, prevFace, prevPrevFace));

    const modifier = pick(MODIFIERS, rng);
    moves.push({ face, modifier, raw: `${face}${modifier}` });

    prevPrevFace = prevFace;
    prevFace = face;
  }
  return moves;
}

/** Règle d'acceptation d'une face compte tenu des deux précédentes. */
function isFaceAllowed(
  face: Face,
  prev: Face | null,
  prevPrev: Face | null,
): boolean {
  if (prev === null) return true;
  // Pas deux fois la même face d'affilée.
  if (face === prev) return false;
  // Sur le même axe que les deux précédents -> redondant.
  if (
    prevPrev !== null &&
    AXIS[face] === AXIS[prev] &&
    AXIS[face] === AXIS[prevPrev]
  ) {
    return false;
  }
  return true;
}

/** Génère un scramble (chaîne) pour un puzzle donné. */
export function generateScramble(
  puzzle: PuzzleType = "333",
  rng: Rng = Math.random,
): string {
  const info = PUZZLES[puzzle];
  // MVP : seuls les puzzles à 6 faces "classiques" utilisent ce générateur.
  // Les autres (Pyraminx/Skewb/Megaminx) auront leur propre générateur.
  if (puzzle === "pyram" || puzzle === "skewb" || puzzle === "minx") {
    throw new Error(
      `Génération de scramble non encore implémentée pour ${puzzle}`,
    );
  }
  const moves = generateMoves(info.scrambleLength, rng);
  return moves.map((m) => m.raw).join(" ");
}
