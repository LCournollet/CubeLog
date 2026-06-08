import type { Direction, Face } from "@/core/scramble/types";

/**
 * Pictogramme d'un mouvement : un patron (net) du cube avec la face concernée
 * surlignée à sa couleur standard et une flèche de rotation par-dessus.
 *
 * Objectif : pouvoir mélanger en suivant UNIQUEMENT ces pictogrammes —
 * on voit quelle face tourner (position + couleur) et dans quel sens.
 */

const FACE_COLOR: Record<Face, string> = {
  U: "#ededed", // blanc
  D: "#ffd23f", // jaune
  F: "#36c46b", // vert
  B: "#3b7dff", // bleu
  L: "#ff8c2a", // orange
  R: "#f0494a", // rouge
};

/** Faces claires : la flèche doit être sombre pour rester lisible. */
const LIGHT_FACES: Face[] = ["U", "D"];

/** Disposition du patron : 4 colonnes × 3 lignes. */
const NET: Array<{ face: Face; col: number; row: number }> = [
  { face: "U", col: 1, row: 0 },
  { face: "L", col: 0, row: 1 },
  { face: "F", col: 1, row: 1 },
  { face: "R", col: 2, row: 1 },
  { face: "B", col: 3, row: 1 },
  { face: "D", col: 1, row: 2 },
];

const CELL = 26;
const STEP = 29;

interface CubeMoveIconProps {
  face: Face;
  direction: Direction;
  size?: number;
}

export function CubeMoveIcon({ face, direction, size = 116 }: CubeMoveIconProps) {
  const width = 4 * STEP - (STEP - CELL); // 113
  const height = 3 * STEP - (STEP - CELL); // 84
  const ratio = height / width;

  return (
    <svg
      width={size}
      height={size * ratio}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Face ${face}, ${direction}`}
    >
      {NET.map((cell) => {
        const x = cell.col * STEP;
        const y = cell.row * STEP;
        const active = cell.face === face;
        const color = FACE_COLOR[cell.face];
        return (
          <g key={cell.face}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={4}
              fill={color}
              opacity={active ? 1 : 0.16}
              stroke={active ? "rgba(0,0,0,0.35)" : "var(--border)"}
              strokeWidth={active ? 1.5 : 1}
            />
            {/* Lettre de la face (repère) */}
            <text
              x={x + 4}
              y={y + 9}
              fontSize={7}
              fontWeight={700}
              fill={
                active
                  ? LIGHT_FACES.includes(cell.face)
                    ? "rgba(0,0,0,0.6)"
                    : "rgba(255,255,255,0.85)"
                  : "var(--text-faint)"
              }
            >
              {cell.face}
            </text>
            {active && (
              <g transform={`translate(${x + 1.5}, ${y + 2}) scale(${(CELL - 3) / 24})`}>
                <RotationArrow
                  direction={direction}
                  light={LIGHT_FACES.includes(cell.face)}
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Flèche de rotation dans un repère 24×24. */
function RotationArrow({
  direction,
  light,
}: {
  direction: Direction;
  light: boolean;
}) {
  const stroke = light ? "#1a1d24" : "#ffffff";

  // Flèche horaire de base (arc ~270° + tête).
  const cw = (
    <>
      <path
        d="M12 4.5 A7.5 7.5 0 1 1 4.5 12"
        fill="none"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <polygon points="4.5,18 0.5,11 8.5,11" fill={stroke} />
    </>
  );

  if (direction === "ccw") {
    // Miroir horizontal => sens anti-horaire.
    return <g transform="translate(24,0) scale(-1,1)">{cw}</g>;
  }

  if (direction === "double") {
    // Deux têtes (demi-tour 180°).
    return (
      <g>
        {cw}
        <polygon points="19,5 12,1 12.5,9" fill={stroke} />
      </g>
    );
  }

  return cw;
}
