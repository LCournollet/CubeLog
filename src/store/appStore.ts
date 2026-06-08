import { create } from "zustand";

import * as api from "@/api/commands";
import type {
  NewSolve,
  Penalty,
  PuzzleType,
  Session,
  Solve,
} from "@/core/types";

interface AppState {
  sessions: Session[];
  currentSessionId: number | null;
  /** Solves de la session courante, en ordre chronologique (ancien -> récent). */
  solves: Solve[];
  loading: boolean;
  /** Dernier solve supprimé (pour annuler/restaurer). */
  lastDeleted: Solve | null;

  init: () => Promise<void>;
  selectSession: (id: number) => Promise<void>;
  createSession: (name: string, puzzle: PuzzleType) => Promise<void>;
  renameSession: (id: number, name: string) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;

  addSolve: (solve: NewSolve) => Promise<Solve>;
  setPenalty: (id: number, penalty: Penalty) => Promise<void>;
  setComment: (id: number, comment: string | null) => Promise<void>;
  deleteSolve: (id: number) => Promise<void>;
  restoreLastDeleted: () => Promise<void>;

  currentSession: () => Session | undefined;
}

const LAST_SESSION_KEY = "lastSessionId";

/** Store central des sessions et solves. Toute la logique métier passe ici,
 *  les composants restent de simples vues. */
export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  solves: [],
  loading: false,
  lastDeleted: null,

  init: async () => {
    set({ loading: true });
    const sessions = await api.listSessions();

    // Restaure la dernière session utilisée si possible.
    let target = sessions[0]?.id ?? null;
    try {
      const settings = await api.getSettings();
      const saved = settings[LAST_SESSION_KEY];
      if (saved) {
        const id = parseInt(saved, 10);
        if (sessions.some((s) => s.id === id)) target = id;
      }
    } catch {
      // ignore
    }

    set({ sessions, currentSessionId: target, loading: false });
    if (target !== null) await get().selectSession(target);
  },

  selectSession: async (id) => {
    set({ currentSessionId: id, loading: true });
    const solves = await api.listSolves(id);
    set({ solves, loading: false });
    await api.setSetting(LAST_SESSION_KEY, String(id));
  },

  createSession: async (name, puzzle) => {
    const session = await api.createSession(name, puzzle);
    set((s) => ({ sessions: [...s.sessions, session] }));
    await get().selectSession(session.id);
  },

  renameSession: async (id, name) => {
    await api.renameSession(id, name);
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, name } : x)),
    }));
  },

  deleteSession: async (id) => {
    await api.deleteSession(id);
    const remaining = get().sessions.filter((s) => s.id !== id);
    set({ sessions: remaining });
    if (get().currentSessionId === id) {
      const next = remaining[0]?.id ?? null;
      if (next !== null) await get().selectSession(next);
      else set({ currentSessionId: null, solves: [] });
    }
  },

  addSolve: async (newSolve) => {
    const solve = await api.addSolve(newSolve);
    set((s) => ({
      solves: [...s.solves, solve],
      sessions: bumpCount(s.sessions, solve.sessionId, +1),
    }));
    return solve;
  },

  setPenalty: async (id, penalty) => {
    const updated = await api.setSolvePenalty(id, penalty);
    set((s) => ({
      solves: s.solves.map((x) => (x.id === id ? updated : x)),
    }));
  },

  setComment: async (id, comment) => {
    await api.setSolveComment(id, comment);
    set((s) => ({
      solves: s.solves.map((x) => (x.id === id ? { ...x, comment } : x)),
    }));
  },

  deleteSolve: async (id) => {
    const target = get().solves.find((x) => x.id === id) ?? null;
    await api.setSolveStatus(id, "deleted");
    set((s) => ({
      solves: s.solves.filter((x) => x.id !== id),
      lastDeleted: target,
      sessions: target
        ? bumpCount(s.sessions, target.sessionId, -1)
        : s.sessions,
    }));
  },

  restoreLastDeleted: async () => {
    const last = get().lastDeleted;
    if (!last) return;
    await api.setSolveStatus(last.id, "normal");
    // Réinsère en respectant l'ordre chronologique.
    set((s) => {
      const next = [...s.solves, { ...last, status: "normal" as const }].sort(
        (a, b) => a.createdAt - b.createdAt || a.id - b.id,
      );
      return {
        solves: next,
        lastDeleted: null,
        sessions: bumpCount(s.sessions, last.sessionId, +1),
      };
    });
  },

  currentSession: () =>
    get().sessions.find((s) => s.id === get().currentSessionId),
}));

/** Ajuste le compteur de solves d'une session (affichage immédiat). */
function bumpCount(
  sessions: Session[],
  sessionId: number,
  delta: number,
): Session[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? { ...s, solveCount: Math.max(0, (s.solveCount ?? 0) + delta) }
      : s,
  );
}
