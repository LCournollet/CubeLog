import type { Penalty } from "../types";

/**
 * Phases du chronomètre (mode clavier).
 *  idle       : au repos, en attente.
 *  inspecting : inspection WCA en cours.
 *  arming     : barre espace enfoncée, pas encore maintenue assez longtemps.
 *  ready      : maintien suffisant, le relâchement lancera le chrono.
 *  running    : chronométrage en cours.
 *  stopped    : chrono arrêté, temps final disponible.
 */
export type TimerPhase =
  | "idle"
  | "inspecting"
  | "arming"
  | "ready"
  | "running"
  | "stopped";

/** État complet de la machine de timing clavier (domaine performance.now). */
export interface KeyboardTimerState {
  phase: TimerPhase;
  inspectionStart: number | null;
  holdStart: number | null;
  solveStart: number | null;
  solveEnd: number | null;
  /** Temps écoulé courant (running) ou final (stopped), en ms. */
  elapsedMs: number;
  /** Pénalité déduite de l'inspection, figée au démarrage du solve. */
  inspectionPenalty: Penalty;
}

/** Événements pilotant la machine, horodatés (performance.now). */
export type TimerEvent =
  | { type: "down"; t: number }
  | { type: "up"; t: number }
  | { type: "tick"; t: number }
  | { type: "reset" };

export const initialKeyboardState: KeyboardTimerState = {
  phase: "idle",
  inspectionStart: null,
  holdStart: null,
  solveStart: null,
  solveEnd: null,
  elapsedMs: 0,
  inspectionPenalty: "none",
};
