import { describe, expect, it } from "vitest";

import type { Penalty, Solve } from "../types";
import {
  bestAverage,
  bestSingle,
  computeSessionStats,
  currentAverage,
  mean,
  trimCount,
  trimmedAverage,
  worstSingle,
} from "./statistics";

/** Fabrique un solve minimal à partir d'un temps (ms) et d'une pénalité. */
function mk(timeMs: number, penalty: Penalty = "none"): Solve {
  const finalTimeMs =
    penalty === "dnf" ? null : penalty === "plus2" ? timeMs + 2000 : timeMs;
  return {
    id: timeMs,
    sessionId: 1,
    puzzle: "333",
    createdAt: timeMs,
    scramble: "R U",
    timeMs,
    penalty,
    finalTimeMs,
    comment: null,
    source: "keyboard",
    status: "normal",
  };
}

describe("trimCount", () => {
  it("retire 1 par extrémité pour Ao5 et Ao12", () => {
    expect(trimCount(5)).toBe(1);
    expect(trimCount(12)).toBe(1);
  });
  it("retire 5% pour les grandes moyennes", () => {
    expect(trimCount(50)).toBe(3);
    expect(trimCount(100)).toBe(5);
  });
});

describe("trimmedAverage", () => {
  it("retire le meilleur et le pire (Ao5)", () => {
    // [1,2,3,4,5] -> retire 1 et 5 -> moyenne de 2,3,4 = 3
    const r = trimmedAverage([5, 1, 3, 2, 4]);
    expect(r.value).toBe(3);
    expect(r.isDnf).toBe(false);
  });

  it("un seul DNF est rogné (Ao5)", () => {
    const r = trimmedAverage([2000, 3000, 4000, 5000, Infinity]);
    // retire Infinity (pire) et 2000 (meilleur) -> moyenne 3000,4000,5000
    expect(r.value).toBe(4000);
    expect(r.isDnf).toBe(false);
  });

  it("deux DNF rendent l'Ao5 DNF", () => {
    const r = trimmedAverage([2000, 3000, 4000, Infinity, Infinity]);
    expect(r.isDnf).toBe(true);
    expect(r.value).toBeNull();
  });
});

describe("singles & mean", () => {
  const solves = [mk(3000), mk(1000), mk(5000, "dnf"), mk(2000, "plus2")];

  it("bestSingle ignore les DNF", () => {
    expect(bestSingle(solves).value).toBe(1000);
  });
  it("worstSingle ignore les DNF", () => {
    // 2000+2000(plus2)=4000 est le pire fini
    expect(worstSingle(solves).value).toBe(4000);
  });
  it("mean est DNF s'il y a un DNF", () => {
    expect(mean(solves).isDnf).toBe(true);
  });
  it("mean calcule la moyenne sinon", () => {
    expect(mean([mk(2000), mk(4000)]).value).toBe(3000);
  });
});

describe("currentAverage & bestAverage", () => {
  it("currentAverage indisponible sous le seuil", () => {
    expect(currentAverage([mk(1000), mk(2000)], 5).value).toBeNull();
  });

  it("bestAverage trouve la meilleure fenêtre glissante", () => {
    const solves = [
      mk(10000),
      mk(1000),
      mk(2000),
      mk(3000),
      mk(4000),
      mk(5000),
    ];
    // fenêtres de 5 : [10,1,2,3,4] -> moy(2,3,4)=3000 ; [1,2,3,4,5] -> moy(2,3,4)=3000
    const best = bestAverage(solves, 5);
    expect(best.value).toBe(3000);
  });
});

describe("computeSessionStats", () => {
  it("agrège tout correctement", () => {
    const solves = Array.from({ length: 12 }, (_, i) => mk((i + 1) * 1000));
    const stats = computeSessionStats(solves);
    expect(stats.count).toBe(12);
    expect(stats.dnfCount).toBe(0);
    expect(stats.bestSingle.value).toBe(1000);
    expect(stats.current[5].value).not.toBeNull();
    expect(stats.current[12].value).not.toBeNull();
    expect(stats.current[50].value).toBeNull();
  });

  it("compte les DNF", () => {
    const solves = [mk(1000), mk(2000, "dnf"), mk(3000, "dnf")];
    const stats = computeSessionStats(solves);
    expect(stats.dnfCount).toBe(2);
    expect(stats.dnfRate).toBeCloseTo(2 / 3);
  });
});
