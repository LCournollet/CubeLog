import { useCallback, useEffect, useMemo, useState } from "react";

import { audioIsRunning, startAudio } from "@/api/commands";
import { parseTimeInput } from "@/core/format/time";
import type { NewSolve, Penalty, Solve } from "@/core/types";
import { QuickStats } from "@/components/QuickStats";
import { ScramblePanel } from "@/components/ScramblePanel";
import { SolveDetailModal } from "@/components/SolveDetailModal";
import { SolveList } from "@/components/SolveList";
import { useExternalTimer } from "@/hooks/useExternalTimer";
import { useFormat } from "@/hooks/useFormat";
import { useKeyboardTimer } from "@/hooks/useKeyboardTimer";
import { useAppStore } from "@/store/appStore";
import { useScrambleStore } from "@/store/scrambleStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { Page } from "@/App";

interface MainPageProps {
  onNavigate: (page: Page) => void;
}

export function MainPage({ onNavigate }: MainPageProps) {
  const settings = useSettingsStore((s) => s.settings);
  const { time } = useFormat();

  const sessions = useAppStore((s) => s.sessions);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const currentSession = useAppStore((s) => s.currentSession());
  const solves = useAppStore((s) => s.solves);
  const addSolve = useAppStore((s) => s.addSolve);
  const setPenalty = useAppStore((s) => s.setPenalty);
  const deleteSolve = useAppStore((s) => s.deleteSolve);
  const restoreLast = useAppStore((s) => s.restoreLastDeleted);
  const selectSession = useAppStore((s) => s.selectSession);

  const scramble = useScrambleStore((s) => s.scramble);
  const unsupported = useScrambleStore((s) => s.unsupported);
  const regenerate = useScrambleStore((s) => s.regenerate);
  const setPuzzle = useScrambleStore((s) => s.setPuzzle);

  const [detail, setDetail] = useState<Solve | null>(null);
  const [manualInput, setManualInput] = useState("");

  const lastSolve = solves[solves.length - 1];

  // Le puzzle des scrambles suit le puzzle de la session.
  useEffect(() => {
    if (currentSession) setPuzzle(currentSession.puzzle);
  }, [currentSession?.id, currentSession?.puzzle, setPuzzle]);

  // Enregistre un solve puis prépare le mélange suivant.
  const saveSolve = useCallback(
    async (timeMs: number, penalty: Penalty, source: NewSolve["source"]) => {
      if (currentSessionId === null) return;
      await addSolve({
        sessionId: currentSessionId,
        puzzle: currentSession?.puzzle ?? "333",
        createdAt: Date.now(),
        scramble,
        timeMs,
        penalty,
        source,
      });
      regenerate();
    },
    [currentSessionId, currentSession?.puzzle, scramble, addSolve, regenerate],
  );

  // --- Mode clavier ---
  const kb = useKeyboardTimer({
    enabled: settings.timerMode === "keyboard",
    config: {
      holdThresholdMs: settings.holdToStartMs,
      inspection: {
        enabled: settings.inspectionEnabled,
        seconds: settings.inspectionSeconds,
        plus2GraceSeconds: 2,
      },
    },
    onComplete: (timeMs, inspPenalty) =>
      saveSolve(timeMs, inspPenalty, "keyboard"),
  });

  // --- Mode timer externe ---
  const ext = useExternalTimer({
    enabled: settings.timerMode === "external",
    debounceMs: settings.debounceMs,
    leadMs: settings.externalLeadMs,
    onComplete: (timeMs) => saveSolve(timeMs, "none", "external_timer"),
  });

  // En mode externe, s'assure que la capture micro tourne (sans avoir à passer
  // par l'écran « Connexion timer »). Idempotent : ne redémarre pas si déjà active.
  useEffect(() => {
    if (settings.timerMode !== "external") return;
    let cancelled = false;
    void (async () => {
      try {
        const running = await audioIsRunning();
        if (!running && !cancelled) {
          await startAudio({
            deviceName: settings.audioDeviceName,
            invert: settings.audioInvert,
            threshold: settings.audioThreshold,
          });
        }
      } catch (e) {
        console.error("démarrage de la capture audio :", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    settings.timerMode,
    settings.audioDeviceName,
    settings.audioThreshold,
    settings.audioInvert,
  ]);

  // Affichage central du temps selon le mode.
  const display = useMemo(() => {
    if (settings.timerMode === "keyboard") {
      if (kb.phase === "inspecting" && kb.inspection) {
        return {
          text: Math.ceil(kb.inspection.remaining).toString(),
          cls: `inspection ${kb.inspection.warning}`,
          hint: "Inspection — maintiens Espace pour armer le départ",
        };
      }
      const cls =
        kb.phase === "ready"
          ? "ready"
          : kb.phase === "arming"
            ? "arming"
            : kb.phase === "running"
              ? "running"
              : "";
      const hint =
        kb.phase === "idle"
          ? "Maintiens la barre Espace, relâche pour démarrer"
          : kb.phase === "arming"
            ? "Continue de maintenir…"
            : kb.phase === "ready"
              ? "Prêt ! Relâche pour démarrer"
              : kb.phase === "running"
                ? "Appuie sur une touche pour arrêter"
                : "";
      return { text: time(kb.elapsedMs), cls, hint };
    }
    if (settings.timerMode === "external") {
      const t = ext.liveTimeMs;
      const cls = ext.phase === "running" ? "running" : "";
      const hint =
        ext.phase === "running"
          ? "Chrono en cours…"
          : ext.phase === "stopped"
            ? "Temps enregistré"
            : ext.timerDetected
              ? "Prêt — lance ta résolution"
              : "En attente du timer — vérifie la connexion micro";
      return { text: time(t), cls, hint };
    }
    return { text: "—", cls: "", hint: "Saisis un temps puis Entrée" };
  }, [settings.timerMode, kb, ext, time]);

  const applyToLast = (p: Penalty) => {
    if (lastSolve) void setPenalty(lastSolve.id, p);
  };

  const submitManual = () => {
    const ms = parseTimeInput(manualInput);
    if (ms !== null) {
      void saveSolve(ms, "none", "manual");
      setManualInput("");
    }
  };

  return (
    <div className="main-grid">
      <div className="main-left">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="session-switch">
            <select
              className="select"
              value={currentSessionId ?? ""}
              onChange={(e) => selectSession(Number(e.target.value))}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.solveCount ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div className="grow" />
          <ModeSwitcher />
          <button className="btn" onClick={() => onNavigate("settings")}>
            ⚙ Paramètres
          </button>
        </div>

        {/* Timer */}
        <div className="timer-stage">
          {settings.timerMode === "external" && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--text-dim)",
              }}
            >
              <span
                className={`dot ${
                  ext.running
                    ? "accent"
                    : ext.timerDetected
                      ? "good"
                      : "bad"
                }`}
              />
              {ext.running
                ? "Chrono en cours"
                : ext.timerDetected
                  ? "Timer connecté"
                  : "En attente du timer…"}
            </div>
          )}
          {settings.timerMode === "keyboard" &&
            kb.phase === "inspecting" &&
            kb.inspection && (
              <div className={`inspection-badge ${kb.inspection.warning}`}>
                {Math.max(0, Math.ceil(kb.inspection.remaining))}
              </div>
            )}
          {settings.timerMode === "manual" ? (
            <input
              className="input mono"
              style={{ fontSize: 40, textAlign: "center", width: 280 }}
              placeholder="12.34"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
              autoFocus
            />
          ) : (
            <div className={`timer-display ${display.cls}`}>{display.text}</div>
          )}
          <div className="timer-hint">{display.hint}</div>
        </div>

        {/* Boutons d'action */}
        <div className="btn-row">
          <button className="btn" onClick={regenerate}>
            🔀 Nouveau mélange
          </button>
          <button className="btn" onClick={() => applyToLast("plus2")} disabled={!lastSolve}>
            +2
          </button>
          <button className="btn" onClick={() => applyToLast("dnf")} disabled={!lastSolve}>
            DNF
          </button>
          <button className="btn" onClick={() => applyToLast("none")} disabled={!lastSolve}>
            OK
          </button>
          <button
            className="btn danger"
            onClick={() => lastSolve && deleteSolve(lastSolve.id)}
            disabled={!lastSolve}
          >
            🗑 Supprimer
          </button>
          <button
            className="btn"
            onClick={() => lastSolve && setDetail(lastSolve)}
            disabled={!lastSolve}
          >
            📝 Note
          </button>
        </div>

        {/* Scramble */}
        <ScramblePanel scramble={scramble} unsupported={unsupported} />
      </div>

      {/* Colonne droite */}
      <div className="main-right">
        <QuickStats solves={solves} />
        <div className="card grow" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="row between mb">
            <h3 style={{ margin: 0 }}>Derniers solves</h3>
            <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={restoreLast}>
              ↩ Restaurer
            </button>
          </div>
          <SolveList solves={solves} onSelect={setDetail} />
        </div>
      </div>

      {detail && (
        <SolveDetailModal solve={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

/** Sélecteur de mode de chronométrage (externe / clavier / manuel). */
function ModeSwitcher() {
  const mode = useSettingsStore((s) => s.settings.timerMode);
  const update = useSettingsStore((s) => s.update);
  const modes: Array<[typeof mode, string]> = [
    ["external", "🎙 Timer"],
    ["keyboard", "⌨ Clavier"],
    ["manual", "✎ Manuel"],
  ];
  return (
    <div className="btn-row">
      {modes.map(([m, label]) => (
        <button
          key={m}
          className={`btn ${mode === m ? "primary" : ""}`}
          onClick={() => update({ timerMode: m })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
