import type { Face, Direction } from "./types";

/** Les six faces dans l'ordre canonique. */
export const FACES: readonly Face[] = ["U", "D", "L", "R", "F", "B"] as const;

/**
 * Axe de chaque face. Deux faces sur le même axe sont opposées
 * (U/D, L/R, F/B) et leurs rotations commutent — on s'en sert pour
 * éviter les redondances dans la génération de scramble.
 */
export const AXIS: Record<Face, "x" | "y" | "z"> = {
  R: "x",
  L: "x",
  U: "y",
  D: "y",
  F: "z",
  B: "z",
};

/** Nom français de chaque face (point de vue du solveur face au cube). */
export const FACE_NAME_FR: Record<Face, string> = {
  U: "Face du haut",
  D: "Face du bas",
  L: "Face gauche",
  R: "Face droite",
  F: "Face avant",
  B: "Face arrière",
};

/** Flèche unicode par sens de rotation. */
export const ARROW: Record<Direction, string> = {
  cw: "↻",
  ccw: "↺",
  double: "↻↻",
};

/** Libellé lisible par sens de rotation. */
export const DIRECTION_LABEL: Record<Direction, string> = {
  cw: "sens horaire",
  ccw: "sens anti-horaire",
  double: "demi-tour 180°",
};

/** Texte d'aide affiché une fois pour expliquer la convention horaire. */
export const CLOCKWISE_HELP =
  "Le sens horaire se comprend comme si tu regardais directement la face concernée, " +
  "puis la faisais tourner comme les aiguilles d'une montre.";
