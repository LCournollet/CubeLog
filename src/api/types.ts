/** Types spécifiques à la frontière Tauri (audio, payloads d'événements). */

import type { TimerPhase } from "@/core/timing/types";

export type { Session, Solve, NewSolve } from "@/core/types";

/** Périphérique d'entrée audio. */
export interface AudioDevice {
  name: string;
  isDefault: boolean;
  defaultSampleRate: number | null;
  channels: number | null;
}

/** État décodé du timer Stackmat. */
export type StackmatState =
  | "idle"
  | "ready"
  | "running"
  | "stopped"
  | "unknown";

/** Trame Stackmat décodée (événement "audio://packet"). */
export interface StackmatPacket {
  state: StackmatState;
  timeMs: number;
  header: string;
  validChecksum: boolean;
}

/** Niveau audio périodique (événement "audio://level"). */
export interface LevelPayload {
  rms: number;
  peak: number;
  sampleRate: number;
  lastState: StackmatState | null;
  debugHex: string;
}

/** Options de démarrage de la capture audio. */
export interface StartAudioOptions {
  deviceName: string | null;
  invert: boolean;
  threshold: number;
}

/** Lien utilitaire entre l'état Stackmat et la phase d'UI. */
export const STACKMAT_TO_PHASE: Record<StackmatState, TimerPhase> = {
  idle: "idle",
  ready: "ready",
  running: "running",
  stopped: "stopped",
  unknown: "idle",
};
