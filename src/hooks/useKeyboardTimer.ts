import { useCallback, useEffect, useRef, useState } from "react";

import type { Penalty } from "@/core/types";
import type { KeyboardConfig } from "@/core/timing/keyboardMachine";
import { keyboardReducer } from "@/core/timing/keyboardMachine";
import type { KeyboardTimerState } from "@/core/timing/types";
import { initialKeyboardState } from "@/core/timing/types";
import { inspectionView } from "@/core/timing/inspection";

interface UseKeyboardTimerOptions {
  enabled: boolean;
  config: KeyboardConfig;
  onComplete: (timeMs: number, inspectionPenalty: Penalty) => void;
}

/** Indique si l'événement clavier provient d'un champ de saisie. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Pilote la machine de timing clavier : écoute la barre espace, fait avancer
 * l'horloge via requestAnimationFrame et signale la fin d'un solve.
 */
export function useKeyboardTimer({
  enabled,
  config,
  onComplete,
}: UseKeyboardTimerOptions) {
  const [state, setState] = useState<KeyboardTimerState>(initialKeyboardState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const configRef = useRef(config);
  configRef.current = config;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const prevPhaseRef = useRef(state.phase);

  const dispatch = useCallback(
    (next: KeyboardTimerState) => {
      // Détection de la transition running -> stopped (solve terminé).
      if (prevPhaseRef.current === "running" && next.phase === "stopped") {
        onCompleteRef.current(next.elapsedMs, next.inspectionPenalty);
      }
      prevPhaseRef.current = next.phase;
      setState(next);
    },
    [],
  );

  // Écoute clavier.
  useEffect(() => {
    if (!enabled) {
      setState(initialKeyboardState);
      prevPhaseRef.current = "idle";
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      dispatch(
        keyboardReducer(
          stateRef.current,
          { type: "down", t: performance.now() },
          configRef.current,
        ),
      );
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      dispatch(
        keyboardReducer(
          stateRef.current,
          { type: "up", t: performance.now() },
          configRef.current,
        ),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, dispatch]);

  // Boucle d'horloge.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      if (s.phase === "arming" || s.phase === "running") {
        dispatch(
          keyboardReducer(
            s,
            { type: "tick", t: performance.now() },
            configRef.current,
          ),
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, dispatch]);

  const reset = useCallback(() => {
    prevPhaseRef.current = "idle";
    setState(initialKeyboardState);
  }, []);

  const inspection =
    state.phase === "inspecting" && state.inspectionStart !== null
      ? inspectionView(
          performance.now() - state.inspectionStart,
          config.inspection,
        )
      : null;

  return {
    phase: state.phase,
    elapsedMs: state.elapsedMs,
    inspection,
    reset,
  };
}
