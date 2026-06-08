import type { InspectionConfig } from "./inspection";
import { inspectionPenalty } from "./inspection";
import type { KeyboardTimerState, TimerEvent } from "./types";
import { initialKeyboardState } from "./types";

/** Configuration de la machine clavier. */
export interface KeyboardConfig {
  /** Durée de maintien de la barre espace avant d'être "prêt" (ms). */
  holdThresholdMs: number;
  inspection: InspectionConfig;
}

/**
 * Réducteur PUR de la machine de timing clavier.
 *
 * Flux nominal (inspection désactivée) :
 *   idle --down--> arming --(maintien)--> ready --up--> running --down--> stopped
 *
 * Flux avec inspection :
 *   idle --down--> inspecting --up--> (toujours inspecting)
 *   inspecting --down--> arming --ready--> running ...
 *
 * Le relâchement trop tôt (arming) annule le départ.
 * En `stopped`, le relâchement ramène à `idle` (prêt pour le solve suivant).
 *
 * Aucune horloge interne : le temps vient des champs `t` des événements
 * (domaine performance.now), ce qui rend la machine déterministe et testable.
 */
export function keyboardReducer(
  state: KeyboardTimerState,
  event: TimerEvent,
  config: KeyboardConfig,
): KeyboardTimerState {
  switch (event.type) {
    case "reset":
      return initialKeyboardState;

    case "down":
      return onDown(state, event.t, config);

    case "up":
      return onUp(state, event.t, config);

    case "tick":
      return onTick(state, event.t, config);
  }
}

function onDown(
  state: KeyboardTimerState,
  t: number,
  config: KeyboardConfig,
): KeyboardTimerState {
  switch (state.phase) {
    case "idle":
      if (config.inspection.enabled) {
        return { ...state, phase: "inspecting", inspectionStart: t };
      }
      return { ...state, phase: "arming", holdStart: t };

    case "inspecting":
      // Début du maintien pour armer le départ.
      return { ...state, phase: "arming", holdStart: t };

    case "running":
      // N'importe quel appui arrête le chrono.
      return {
        ...state,
        phase: "stopped",
        solveEnd: t,
        elapsedMs: state.solveStart !== null ? t - state.solveStart : 0,
      };

    default:
      return state;
  }
}

function onUp(
  state: KeyboardTimerState,
  t: number,
  config: KeyboardConfig,
): KeyboardTimerState {
  switch (state.phase) {
    case "arming": {
      // Relâché avant le seuil de maintien -> on annule le départ.
      const heldEnough =
        state.holdStart !== null && t - state.holdStart >= config.holdThresholdMs;
      if (heldEnough) {
        return startSolve(state, t, config);
      }
      // Retour à l'état précédent (inspection ou repos).
      return state.inspectionStart !== null
        ? { ...state, phase: "inspecting", holdStart: null }
        : { ...initialKeyboardState };
    }

    case "ready":
      // Relâchement après maintien suffisant -> départ.
      return startSolve(state, t, config);

    case "stopped":
      // Prêt pour le prochain solve.
      return { ...initialKeyboardState };

    default:
      return state;
  }
}

function onTick(
  state: KeyboardTimerState,
  t: number,
  config: KeyboardConfig,
): KeyboardTimerState {
  switch (state.phase) {
    case "arming": {
      const heldEnough =
        state.holdStart !== null && t - state.holdStart >= config.holdThresholdMs;
      return heldEnough ? { ...state, phase: "ready" } : state;
    }

    case "running":
      return {
        ...state,
        elapsedMs: state.solveStart !== null ? t - state.solveStart : 0,
      };

    default:
      return state;
  }
}

/** Transition commune vers `running` avec calcul de la pénalité d'inspection. */
function startSolve(
  state: KeyboardTimerState,
  t: number,
  config: KeyboardConfig,
): KeyboardTimerState {
  const inspElapsed =
    state.inspectionStart !== null ? t - state.inspectionStart : 0;
  return {
    ...state,
    phase: "running",
    holdStart: null,
    solveStart: t,
    solveEnd: null,
    elapsedMs: 0,
    inspectionPenalty: inspectionPenalty(inspElapsed, config.inspection),
  };
}
