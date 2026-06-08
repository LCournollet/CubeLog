import { invoke } from "@tauri-apps/api/core";

import type {
  NewSolve,
  Penalty,
  PuzzleType,
  Session,
  Solve,
  SolveStatus,
} from "@/core/types";
import type { AudioDevice, StackmatPacket, StartAudioOptions } from "./types";

/**
 * Wrappers typés autour des commandes Tauri. C'est l'unique point d'accès au
 * backend depuis le frontend : aucun `invoke` brut ailleurs dans le code.
 */

// --- Sessions ---

export const listSessions = (): Promise<Session[]> => invoke("list_sessions");

export const createSession = (
  name: string,
  puzzle: PuzzleType,
): Promise<Session> => invoke("create_session", { name, puzzle });

export const renameSession = (id: number, name: string): Promise<void> =>
  invoke("rename_session", { id, name });

export const deleteSession = (id: number): Promise<void> =>
  invoke("delete_session", { id });

// --- Solves ---

export const listSolves = (sessionId: number): Promise<Solve[]> =>
  invoke("list_solves", { sessionId });

export const addSolve = (solve: NewSolve): Promise<Solve> =>
  invoke("add_solve", { solve });

export const setSolvePenalty = (id: number, penalty: Penalty): Promise<Solve> =>
  invoke("set_solve_penalty", { id, penalty });

export const setSolveStatus = (
  id: number,
  status: SolveStatus,
): Promise<void> => invoke("set_solve_status", { id, status });

export const setSolveComment = (
  id: number,
  comment: string | null,
): Promise<void> => invoke("set_solve_comment", { id, comment });

export const deleteSolveHard = (id: number): Promise<void> =>
  invoke("delete_solve_hard", { id });

// --- Réglages ---

export const getSettings = (): Promise<Record<string, string>> =>
  invoke("get_settings");

export const setSetting = (key: string, value: string): Promise<void> =>
  invoke("set_setting", { key, value });

// --- Audio ---

export const listAudioDevices = (): Promise<AudioDevice[]> =>
  invoke("list_audio_devices");

export const startAudio = (options: StartAudioOptions): Promise<void> =>
  invoke("start_audio", { options });

export const stopAudio = (): Promise<void> => invoke("stop_audio");

export const audioIsRunning = (): Promise<boolean> =>
  invoke("audio_is_running");

export const audioSelfTest = (): Promise<StackmatPacket[]> =>
  invoke("audio_self_test");

// --- Export / Import ---

export const exportData = (
  format: "json" | "csv",
  sessionId: number | null,
): Promise<string> => invoke("export_data", { format, sessionId });

export const importData = (json: string): Promise<number> =>
  invoke("import_data", { json });

export const saveTextFile = (path: string, content: string): Promise<void> =>
  invoke("save_text_file", { path, content });

export const readTextFile = (path: string): Promise<string> =>
  invoke("read_text_file", { path });
