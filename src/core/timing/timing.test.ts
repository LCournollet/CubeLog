import { describe, expect, it } from "vitest";

import { inspectionPenalty } from "./inspection";
import type { KeyboardConfig } from "./keyboardMachine";
import { keyboardReducer } from "./keyboardMachine";
import type { KeyboardTimerState, TimerEvent } from "./types";
import { initialKeyboardState } from "./types";

const config: KeyboardConfig = {
  holdThresholdMs: 300,
  inspection: { enabled: false, seconds: 15, plus2GraceSeconds: 2 },
};

/** Applique une suite d'événements à la machine clavier. */
function run(events: TimerEvent[], cfg = config): KeyboardTimerState {
  return events.reduce(
    (state, ev) => keyboardReducer(state, ev, cfg),
    initialKeyboardState,
  );
}

describe("keyboardReducer (sans inspection)", () => {
  it("démarre après un maintien suffisant", () => {
    const s = run([
      { type: "down", t: 0 },
      { type: "tick", t: 350 }, // > holdThreshold -> ready
      { type: "up", t: 360 }, // relâche -> running
    ]);
    expect(s.phase).toBe("running");
    expect(s.solveStart).toBe(360);
  });

  it("annule si relâché trop tôt", () => {
    const s = run([
      { type: "down", t: 0 },
      { type: "up", t: 100 }, // < holdThreshold -> annulé
    ]);
    expect(s.phase).toBe("idle");
  });

  it("chronomètre puis s'arrête sur appui", () => {
    const s = run([
      { type: "down", t: 0 },
      { type: "tick", t: 350 },
      { type: "up", t: 360 }, // running depuis 360
      { type: "tick", t: 1360 },
      { type: "down", t: 5360 }, // stop
    ]);
    expect(s.phase).toBe("stopped");
    expect(s.elapsedMs).toBe(5000);
  });

  it("revient à idle après le solve quand on relâche", () => {
    const s = run([
      { type: "down", t: 0 },
      { type: "tick", t: 350 },
      { type: "up", t: 360 },
      { type: "down", t: 5360 }, // stopped
      { type: "up", t: 5400 }, // -> idle
    ]);
    expect(s.phase).toBe("idle");
  });
});

describe("keyboardReducer (avec inspection)", () => {
  const cfg: KeyboardConfig = {
    holdThresholdMs: 300,
    inspection: { enabled: true, seconds: 15, plus2GraceSeconds: 2 },
  };

  it("première pression lance l'inspection", () => {
    const s = run([{ type: "down", t: 0 }], cfg);
    expect(s.phase).toBe("inspecting");
    expect(s.inspectionStart).toBe(0);
  });

  it("aucune pénalité si départ avant 15 s", () => {
    const s = run(
      [
        { type: "down", t: 0 }, // inspection
        { type: "up", t: 10 },
        { type: "down", t: 5000 }, // arming
        { type: "tick", t: 5350 }, // ready
        { type: "up", t: 5360 }, // running à t=5360 (<15s)
      ],
      cfg,
    );
    expect(s.phase).toBe("running");
    expect(s.inspectionPenalty).toBe("none");
  });
});

describe("inspectionPenalty", () => {
  const cfg = { enabled: true, seconds: 15, plus2GraceSeconds: 2 };
  it("none sous 15 s", () => {
    expect(inspectionPenalty(14000, cfg)).toBe("none");
  });
  it("plus2 entre 15 et 17 s", () => {
    expect(inspectionPenalty(16000, cfg)).toBe("plus2");
  });
  it("dnf au-delà de 17 s", () => {
    expect(inspectionPenalty(18000, cfg)).toBe("dnf");
  });
  it("none si inspection désactivée", () => {
    expect(inspectionPenalty(20000, { ...cfg, enabled: false })).toBe("none");
  });
});
