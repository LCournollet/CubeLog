import { useEffect, useRef, useState } from "react";

import { onAudioLevel, onStackmatPacket } from "@/api/events";
import type { LevelPayload, StackmatPacket } from "@/api/types";

/** Phase d'affichage déduite de la progression du temps. */
export type ExternalPhase = "idle" | "running" | "stopped";

interface UseExternalTimerOptions {
  enabled: boolean;
  /** Délai anti-rebond entre deux enregistrements (ms). */
  debounceMs: number;
  /**
   * Décalage de compensation de latence (ms) ajouté à l'affichage en cours
   * pour s'aligner sur le timer physique. N'affecte pas le temps enregistré.
   */
  leadMs: number;
  /** Appelé une fois quand le timer s'arrête (temps final figé). */
  onComplete: (timeMs: number) => void;
}

/** Temps minimal (ms) pour qu'un arrêt soit considéré comme un vrai solve. */
const MIN_VALID_TIME_MS = 200;

/**
 * Écoute le timer Stackmat via les événements audio.
 *
 * La détection d'arrêt se fait sur la **progression du temps** et non sur
 * l'octet de statut : beaucoup de timers (dont le QiYi testé) continuent
 * d'émettre un statut « running » avec le temps figé une fois arrêtés. On
 * considère donc :
 *  - le temps **augmente** -> le chrono tourne (affichage extrapolé, fluide) ;
 *  - le temps se **fige** après avoir tourné -> arrêt : on enregistre le solve
 *    et on fige l'affichage sur la valeur exacte ;
 *  - le temps **diminue / revient à 0** -> remise à zéro.
 */
export function useExternalTimer({
  enabled,
  debounceMs,
  leadMs,
  onComplete,
}: UseExternalTimerOptions) {
  const [phase, setPhase] = useState<ExternalPhase>("idle");
  const [level, setLevel] = useState<LevelPayload | null>(null);
  const [lastPacket, setLastPacket] = useState<StackmatPacket | null>(null);
  const [timerDetected, setTimerDetected] = useState(false);
  const [liveTimeMs, setLiveTimeMs] = useState(0);

  // Refs pour la boucle d'affichage et la détection (sans re-render).
  const lastTimeMsRef = useRef(0);
  const lastPacketAtRef = useRef(0);
  const countingRef = useRef(false);
  const savedForValueRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);
  /** Première trame reçue : sert de référence, sans décision (évite un faux
   *  arrêt si on se connecte à un timer déjà figé). */
  const syncedRef = useRef(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const debounceRef = useRef(debounceMs);
  debounceRef.current = debounceMs;
  const leadRef = useRef(leadMs);
  leadRef.current = leadMs;

  useEffect(() => {
    if (!enabled) return;
    let unlistenPacket: (() => void) | undefined;
    let unlistenLevel: (() => void) | undefined;

    onStackmatPacket((packet) => {
      const t = packet.timeMs;
      const prev = lastTimeMsRef.current;
      const now = performance.now();

      setLastPacket(packet);
      lastPacketAtRef.current = now;

      if (!syncedRef.current) {
        // Trame de référence : on ne décide rien (le temps peut déjà être
        // élevé si le timer tournait avant la connexion).
        syncedRef.current = true;
        lastTimeMsRef.current = t;
        return;
      }

      // Protocole observé : pendant la course l'en-tête est ' ' (running) et le
      // temps augmente ; à l'arrêt l'en-tête passe à 'I' avec le temps figé ;
      // au reset le temps revient à 0.
      const idleHeader = packet.state === "idle"; // en-tête 'I'

      if (t === 0 || t < prev) {
        // Remise à zéro.
        countingRef.current = false;
        savedForValueRef.current = null;
        setPhase("idle");
      } else if (
        countingRef.current &&
        (idleHeader || t === prev) &&
        t >= MIN_VALID_TIME_MS
      ) {
        // ARRÊT : l'en-tête est passé à 'I' (ou le temps s'est figé) alors que
        // l'on comptait -> fige et enregistre le temps final exact.
        countingRef.current = false;
        setPhase("stopped");
        if (
          savedForValueRef.current !== t &&
          now - lastSaveRef.current >= debounceRef.current
        ) {
          savedForValueRef.current = t;
          lastSaveRef.current = now;
          onCompleteRef.current(t);
        }
      } else if (!idleHeader && t > prev) {
        // Le temps avance avec l'en-tête running : le chrono tourne.
        countingRef.current = true;
        savedForValueRef.current = null;
        setPhase("running");
      }
      // Autres cas (en-tête 'I' figé hors course, trames redondantes) : on ne
      // change rien — l'affichage reste figé sur la dernière valeur.

      lastTimeMsRef.current = t;
    }).then((fn) => {
      unlistenPacket = fn;
    });

    onAudioLevel(setLevel).then((fn) => {
      unlistenLevel = fn;
    });

    // Fraîcheur de la détection (trame reçue récemment).
    const interval = setInterval(() => {
      setTimerDetected(performance.now() - lastPacketAtRef.current < 1500);
    }, 400);

    // Boucle d'affichage : extrapole tant que le chrono tourne, fige sinon.
    let raf = 0;
    const loop = () => {
      if (countingRef.current) {
        const extra = performance.now() - lastPacketAtRef.current;
        setLiveTimeMs(lastTimeMsRef.current + extra + leadRef.current);
      } else {
        setLiveTimeMs(lastTimeMsRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      unlistenPacket?.();
      unlistenLevel?.();
      clearInterval(interval);
      cancelAnimationFrame(raf);
      // Réinitialise pour la prochaine activation.
      countingRef.current = false;
      lastTimeMsRef.current = 0;
      syncedRef.current = false;
    };
  }, [enabled]);

  return {
    phase,
    level,
    lastPacket,
    timerDetected,
    liveTimeMs,
    running: phase === "running",
  };
}
