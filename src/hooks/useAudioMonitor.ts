import { useEffect, useRef, useState } from "react";

import { onAudioLevel, onStackmatPacket } from "@/api/events";
import type { LevelPayload, StackmatPacket } from "@/api/types";

export interface AudioMonitor {
  level: LevelPayload | null;
  lastPacket: StackmatPacket | null;
  totalPackets: number;
  validPackets: number;
  /** Qualité de décodage 0..1 (trames valides / total). */
  quality: number;
  /** Vrai si une trame valide a été reçue récemment. */
  timerDetected: boolean;
}

/**
 * Surveille le flux audio (niveau + trames) sans enregistrer de solve.
 * Utilisé par les écrans de connexion et de diagnostic.
 */
export function useAudioMonitor(active: boolean): AudioMonitor {
  const [level, setLevel] = useState<LevelPayload | null>(null);
  const [lastPacket, setLastPacket] = useState<StackmatPacket | null>(null);
  const [counts, setCounts] = useState({ total: 0, valid: 0 });
  const lastValidAtRef = useRef<number>(0);
  const [timerDetected, setTimerDetected] = useState(false);

  useEffect(() => {
    if (!active) {
      setLevel(null);
      setLastPacket(null);
      setCounts({ total: 0, valid: 0 });
      setTimerDetected(false);
      return;
    }
    let unlistenLevel: (() => void) | undefined;
    let unlistenPacket: (() => void) | undefined;

    onAudioLevel(setLevel).then((fn) => (unlistenLevel = fn));
    onStackmatPacket((p) => {
      setLastPacket(p);
      setCounts((c) => ({
        total: c.total + 1,
        valid: c.valid + (p.validChecksum ? 1 : 0),
      }));
      if (p.validChecksum) lastValidAtRef.current = performance.now();
    }).then((fn) => (unlistenPacket = fn));

    // Vérifie la fraîcheur de la détection.
    const interval = setInterval(() => {
      setTimerDetected(performance.now() - lastValidAtRef.current < 1500);
    }, 500);

    return () => {
      unlistenLevel?.();
      unlistenPacket?.();
      clearInterval(interval);
    };
  }, [active]);

  const quality = counts.total === 0 ? 0 : counts.valid / counts.total;

  return {
    level,
    lastPacket,
    totalPackets: counts.total,
    validPackets: counts.valid,
    quality,
    timerDetected,
  };
}
