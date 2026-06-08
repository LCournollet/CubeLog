import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { LevelPayload, StackmatPacket } from "./types";

/** Abonne un handler aux trames Stackmat décodées. */
export function onStackmatPacket(
  handler: (packet: StackmatPacket) => void,
): Promise<UnlistenFn> {
  return listen<StackmatPacket>("audio://packet", (e) => handler(e.payload));
}

/** Abonne un handler aux mises à jour de niveau audio. */
export function onAudioLevel(
  handler: (level: LevelPayload) => void,
): Promise<UnlistenFn> {
  return listen<LevelPayload>("audio://level", (e) => handler(e.payload));
}
