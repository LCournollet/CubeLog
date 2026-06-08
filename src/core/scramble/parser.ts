import type { Face, Modifier, Move } from "./types";
import { FACES } from "./moves";

const FACE_SET = new Set<string>(FACES);

/** Erreur de parsing d'un scramble. */
export class ScrambleParseError extends Error {
  constructor(
    message: string,
    public readonly token: string,
  ) {
    super(message);
    this.name = "ScrambleParseError";
  }
}

/**
 * Parse une chaîne de scramble en notation Singmaster (faces externes
 * uniquement pour le MVP 3x3) en une liste de mouvements typés.
 *
 * Tolère les espaces multiples. Lève ScrambleParseError sur un token invalide.
 *
 * Exemples acceptés : "R", "U'", "F2", "R U R' F2 D L'".
 */
export function parseScramble(input: string): Move[] {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const moves: Move[] = [];

  for (const token of tokens) {
    const move = parseMove(token);
    moves.push(move);
  }
  return moves;
}

/** Parse un seul token de mouvement, ex. "R'". */
export function parseMove(token: string): Move {
  if (token.length < 1 || token.length > 2) {
    throw new ScrambleParseError(`Mouvement invalide : "${token}"`, token);
  }
  const face = token[0] as string;
  if (!FACE_SET.has(face)) {
    throw new ScrambleParseError(`Face inconnue : "${face}"`, token);
  }
  const modRaw = token.slice(1);
  if (modRaw !== "" && modRaw !== "'" && modRaw !== "2") {
    throw new ScrambleParseError(`Modificateur invalide : "${modRaw}"`, token);
  }
  return {
    face: face as Face,
    modifier: modRaw as Modifier,
    raw: token,
  };
}

/** Vérifie qu'une chaîne est un scramble valide sans lever d'erreur. */
export function isValidScramble(input: string): boolean {
  try {
    parseScramble(input);
    return true;
  } catch {
    return false;
  }
}

/** Reconstruit une chaîne de scramble canonique à partir de mouvements. */
export function stringifyScramble(moves: Move[]): string {
  return moves.map((m) => `${m.face}${m.modifier}`).join(" ");
}
