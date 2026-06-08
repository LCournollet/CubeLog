/** Les six faces standard d'un cube en notation Singmaster. */
export type Face = "U" | "D" | "L" | "R" | "F" | "B";

/** Modificateur d'un mouvement : normal, prime (anti-horaire), double (180°). */
export type Modifier = "" | "'" | "2";

/** Un mouvement décomposé. */
export interface Move {
  face: Face;
  modifier: Modifier;
  /** Représentation textuelle, ex. "R'", "U2". */
  raw: string;
}

/** Sens de rotation pour l'aide débutant. */
export type Direction = "cw" | "ccw" | "double";

/** Une étape expliquée pour le mode débutant. */
export interface BeginnerStep {
  /** Notation technique, ex. "R'". */
  notation: string;
  face: Face;
  /** Nom français de la face, ex. "Face droite". */
  faceName: string;
  direction: Direction;
  /** Libellé du sens, ex. "sens anti-horaire". */
  directionLabel: string;
  /** Flèche unicode, ex. "↺". */
  arrow: string;
  /** Courte explication pédagogique. */
  explanation: string;
}

/** Source d'aléa injectable (testabilité). Retourne [0, 1). */
export type Rng = () => number;
