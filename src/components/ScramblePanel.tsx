import { useMemo } from "react";

import { toBeginnerSteps } from "@/core/scramble/beginner";
import { CLOCKWISE_HELP } from "@/core/scramble/moves";
import { parseScramble } from "@/core/scramble/parser";
import { useSettingsStore } from "@/store/settingsStore";
import { CubeMoveIcon } from "./CubeMoveIcon";

interface ScramblePanelProps {
  scramble: string;
  unsupported?: boolean;
}

/**
 * Affiche le scramble en deux modes côte à côte :
 *  - gauche : notation technique speedcubing ;
 *  - droite : version débutant avec flèches et explications.
 * Les deux restent visibles ensemble pour apprendre et comparer.
 */
export function ScramblePanel({ scramble, unsupported }: ScramblePanelProps) {
  const { beginnerEnabled, beginnerMode, beginnerArrowsOnly, scrambleSize } =
    useSettingsStore((s) => s.settings);

  const moves = useMemo(() => {
    try {
      return parseScramble(scramble);
    } catch {
      return [];
    }
  }, [scramble]);

  const steps = useMemo(() => {
    if (!beginnerEnabled) return [];
    try {
      return toBeginnerSteps(scramble);
    } catch {
      return [];
    }
  }, [scramble, beginnerEnabled]);

  if (unsupported) {
    return (
      <div className="card">
        <h3>Mélange</h3>
        <p className="muted">
          La génération de mélange n'est pas encore disponible pour ce puzzle.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className={beginnerEnabled ? "scramble-panel" : ""}>
        {/* Notation technique */}
        <div>
          <h3>Notation technique</h3>
          <div className={`scramble-technical ${scrambleSize}`}>
            {moves.map((m, i) => (
              <span key={i} className="scramble-move">
                {m.raw}{" "}
              </span>
            ))}
          </div>
        </div>

        {/* Version débutant : le mélange à réaliser, étape par étape */}
        {beginnerEnabled && (
          <div>
            <h3>Aide débutant — mélange à faire</h3>
            {beginnerMode === "compact" ? (
              <div className="beginner-grid">
                {steps.map((s, i) => (
                  <div className="beginner-card" key={i} title={s.explanation}>
                    <span className="step-num">{i + 1}</span>
                    <CubeMoveIcon
                      face={s.face}
                      direction={s.direction}
                      size={64}
                    />
                    <span className="notation">{s.notation}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="beginner-list">
                {steps.map((s, i) => (
                  <div className="beginner-step" key={i}>
                    <span className="step-num">{i + 1}</span>
                    <CubeMoveIcon
                      face={s.face}
                      direction={s.direction}
                      size={72}
                    />
                    <span className="desc">
                      <span className="notation">{s.notation}</span>{" "}
                      <span className="arrow" aria-hidden>
                        {s.arrow}
                      </span>
                      <br />
                      <span className="face-name">{s.faceName}</span>,{" "}
                      <span>{s.directionLabel}</span>
                      {!beginnerArrowsOnly && (
                        <>
                          <br />
                          <span className="explain">{s.explanation}</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="help-note">
              Suis les flèches dans l'ordre (1 → {steps.length}) pour reproduire
              le mélange. {CLOCKWISE_HELP}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
