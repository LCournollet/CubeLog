import { create } from "zustand";

import { generateScramble } from "@/core/scramble";
import type { PuzzleType } from "@/core/types";

interface ScrambleState {
  puzzle: PuzzleType;
  scramble: string;
  /** Vrai si le puzzle courant ne dispose pas encore d'un générateur. */
  unsupported: boolean;
  setPuzzle: (puzzle: PuzzleType) => void;
  regenerate: () => void;
}

function makeScramble(puzzle: PuzzleType): {
  scramble: string;
  unsupported: boolean;
} {
  try {
    return { scramble: generateScramble(puzzle), unsupported: false };
  } catch {
    return { scramble: "", unsupported: true };
  }
}

/** Détient le scramble affiché. Le solve enregistré capture ce scramble au
 *  moment du départ ; après enregistrement on appelle regenerate(). */
export const useScrambleStore = create<ScrambleState>((set, get) => ({
  puzzle: "333",
  ...makeScramble("333"),

  setPuzzle: (puzzle) => {
    set({ puzzle, ...makeScramble(puzzle) });
  },

  regenerate: () => {
    set(makeScramble(get().puzzle));
  },
}));
