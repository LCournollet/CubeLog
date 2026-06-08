import { describe, expect, it } from "vitest";

import { toBeginnerSteps } from "./beginner";
import { generateMoves, generateScramble } from "./generator";
import { AXIS } from "./moves";
import { isValidScramble, parseScramble, ScrambleParseError } from "./parser";
import type { Rng } from "./types";

/** Générateur pseudo-aléatoire déterministe (LCG) pour des tests reproductibles. */
function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("parser", () => {
  it("parse une notation valide", () => {
    const moves = parseScramble("R U R' F2 D L'");
    expect(moves.map((m) => m.raw)).toEqual(["R", "U", "R'", "F2", "D", "L'"]);
    expect(moves[2]).toMatchObject({ face: "R", modifier: "'" });
    expect(moves[3]).toMatchObject({ face: "F", modifier: "2" });
  });

  it("tolère les espaces multiples", () => {
    expect(parseScramble("  R   U  ")).toHaveLength(2);
  });

  it("rejette une face inconnue", () => {
    expect(() => parseScramble("X")).toThrow(ScrambleParseError);
  });

  it("rejette un modificateur invalide", () => {
    expect(() => parseScramble("R3")).toThrow(ScrambleParseError);
  });

  it("isValidScramble", () => {
    expect(isValidScramble("R U R'")).toBe(true);
    expect(isValidScramble("R Q2")).toBe(false);
  });
});

describe("generator", () => {
  it("génère la bonne longueur", () => {
    const moves = generateMoves(20, seededRng(42));
    expect(moves).toHaveLength(20);
  });

  it("ne répète jamais la même face consécutivement", () => {
    const moves = generateMoves(200, seededRng(7));
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].face).not.toBe(moves[i - 1].face);
    }
  });

  it("n'enchaîne pas trois mouvements sur le même axe", () => {
    const moves = generateMoves(300, seededRng(123));
    for (let i = 2; i < moves.length; i++) {
      const sameAxis =
        AXIS[moves[i].face] === AXIS[moves[i - 1].face] &&
        AXIS[moves[i].face] === AXIS[moves[i - 2].face];
      expect(sameAxis).toBe(false);
    }
  });

  it("est déterministe pour une même graine", () => {
    expect(generateScramble("333", seededRng(99))).toBe(
      generateScramble("333", seededRng(99)),
    );
  });

  it("lève pour un puzzle non supporté", () => {
    expect(() => generateScramble("pyram")).toThrow();
  });
});

describe("beginner", () => {
  it("traduit chaque mouvement avec face, sens et flèche", () => {
    const steps = toBeginnerSteps("R U' F2");
    expect(steps[0]).toMatchObject({
      notation: "R",
      faceName: "Face droite",
      direction: "cw",
      arrow: "↻",
    });
    expect(steps[1]).toMatchObject({ direction: "ccw", arrow: "↺" });
    expect(steps[2]).toMatchObject({ direction: "double", arrow: "↻↻" });
  });

  it("fournit une explication pour chaque étape", () => {
    const steps = toBeginnerSteps("L D B");
    for (const s of steps) {
      expect(s.explanation.length).toBeGreaterThan(0);
      expect(s.faceName.length).toBeGreaterThan(0);
    }
  });
});
