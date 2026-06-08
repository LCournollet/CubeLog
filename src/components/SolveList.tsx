import type { Solve } from "@/core/types";
import { useFormat } from "@/hooks/useFormat";

interface SolveListProps {
  solves: Solve[];
  onSelect: (solve: Solve) => void;
}

/** Liste des solves (le plus récent en haut). */
export function SolveList({ solves, onSelect }: SolveListProps) {
  const { solve: fmtSolve } = useFormat();
  const reversed = [...solves].reverse();

  if (solves.length === 0) {
    return (
      <div className="solve-list">
        <p className="faint" style={{ padding: 12 }}>
          Aucun solve pour l'instant. Lance ton premier chrono !
        </p>
      </div>
    );
  }

  return (
    <div className="solve-list">
      {reversed.map((s, i) => {
        const number = solves.length - i;
        const isDnf = s.penalty === "dnf";
        return (
          <button
            key={s.id}
            className="solve-row"
            onClick={() => onSelect(s)}
            style={{
              background: "transparent",
              border: "none",
              textAlign: "left",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="idx">{number}.</span>
            <span className={`time ${isDnf ? "dnf" : ""}`}>
              {fmtSolve(s.finalTimeMs, s.penalty)}
            </span>
            <span className="badge">
              {s.penalty === "plus2" && "+2 "}
              {s.comment ? "📝" : ""}
              {s.source === "external_timer"
                ? "🎙"
                : s.source === "manual"
                  ? "✎"
                  : "⌨"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
