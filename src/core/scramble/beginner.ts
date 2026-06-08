import type { BeginnerStep, Direction, Move } from "./types";
import { parseScramble } from "./parser";
import {
  ARROW,
  DIRECTION_LABEL,
  FACE_NAME_FR,
} from "./moves";

/** Convertit un modificateur en sens de rotation. */
function directionOf(modifier: Move["modifier"]): Direction {
  switch (modifier) {
    case "":
      return "cw";
    case "'":
      return "ccw";
    case "2":
      return "double";
  }
}

/** Construit l'explication pédagogique d'un mouvement. */
function explain(faceName: string, direction: Direction): string {
  const lower = faceName.toLowerCase();
  switch (direction) {
    case "cw":
      return `Tourne la ${lower} d'un quart de tour dans le sens horaire.`;
    case "ccw":
      return `Tourne la ${lower} d'un quart de tour dans le sens anti-horaire.`;
    case "double":
      return `Tourne la ${lower} d'un demi-tour (180°), le sens n'a pas d'importance.`;
  }
}

/** Transforme un mouvement en étape débutant expliquée. */
export function moveToBeginnerStep(move: Move): BeginnerStep {
  const direction = directionOf(move.modifier);
  const faceName = FACE_NAME_FR[move.face];
  return {
    notation: move.raw,
    face: move.face,
    faceName,
    direction,
    directionLabel: DIRECTION_LABEL[direction],
    arrow: ARROW[direction],
    explanation: explain(faceName, direction),
  };
}

/**
 * Convertit un scramble technique en liste d'étapes "débutant" avec flèches
 * et explications. C'est la version affichée à côté de la notation technique.
 */
export function toBeginnerSteps(scramble: string): BeginnerStep[] {
  return parseScramble(scramble).map(moveToBeginnerStep);
}
