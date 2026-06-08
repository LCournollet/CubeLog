import { useState } from "react";

import type { Penalty, Solve } from "@/core/types";
import { useFormat } from "@/hooks/useFormat";
import { useAppStore } from "@/store/appStore";
import { Modal } from "./Modal";

interface SolveDetailModalProps {
  solve: Solve;
  onClose: () => void;
}

/** Détail d'un solve + actions (pénalités, note, suppression, copie). */
export function SolveDetailModal({ solve, onClose }: SolveDetailModalProps) {
  const { time, solve: fmtSolve } = useFormat();
  const setPenalty = useAppStore((s) => s.setPenalty);
  const setComment = useAppStore((s) => s.setComment);
  const deleteSolve = useAppStore((s) => s.deleteSolve);

  const [note, setNote] = useState(solve.comment ?? "");
  const date = new Date(solve.createdAt);

  const applyPenalty = (p: Penalty) => setPenalty(solve.id, p);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const remove = async () => {
    await deleteSolve(solve.id);
    onClose();
  };

  return (
    <Modal
      title={`Solve #${solve.id}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={remove}>
            Supprimer
          </button>
          <button className="btn primary" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      <div className="row between mb">
        <span
          className="mono"
          style={{ fontSize: 28, fontWeight: 700 }}
        >
          {fmtSolve(solve.finalTimeMs, solve.penalty)}
        </span>
        <span className="faint" style={{ fontSize: 12 }}>
          {date.toLocaleString("fr-FR")}
        </span>
      </div>

      <div className="muted mb" style={{ fontSize: 12 }}>
        Temps brut : <span className="mono">{time(solve.timeMs)}</span> ·
        Source :{" "}
        {solve.source === "external_timer"
          ? "timer externe"
          : solve.source === "manual"
            ? "manuel"
            : "clavier"}
      </div>

      <h3>Pénalité</h3>
      <div className="btn-row mb">
        <button
          className={`btn ${solve.penalty === "none" ? "primary" : ""}`}
          onClick={() => applyPenalty("none")}
        >
          OK
        </button>
        <button
          className={`btn ${solve.penalty === "plus2" ? "primary" : ""}`}
          onClick={() => applyPenalty("plus2")}
        >
          +2
        </button>
        <button
          className={`btn ${solve.penalty === "dnf" ? "primary" : ""}`}
          onClick={() => applyPenalty("dnf")}
        >
          DNF
        </button>
      </div>

      <h3>Mélange</h3>
      <div className="mono mb" style={{ fontSize: 14, lineHeight: 1.6 }}>
        {solve.scramble}
      </div>

      <h3>Note</h3>
      <textarea
        className="input"
        style={{ width: "100%", minHeight: 60, resize: "vertical" }}
        value={note}
        placeholder="Ajouter une note…"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => setComment(solve.id, note.trim() || null)}
      />

      <div className="btn-row mt">
        <button
          className="btn ghost"
          onClick={() => copy(fmtSolve(solve.finalTimeMs, solve.penalty))}
        >
          Copier le temps
        </button>
        <button className="btn ghost" onClick={() => copy(solve.scramble)}>
          Copier le mélange
        </button>
      </div>
    </Modal>
  );
}
