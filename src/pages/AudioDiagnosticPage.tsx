import { useEffect, useState } from "react";

import {
  audioIsRunning,
  audioSelfTest,
  startAudio,
  stopAudio,
} from "@/api/commands";
import type { StackmatPacket } from "@/api/types";
import { SignalMeter } from "@/components/SignalMeter";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useSettingsStore } from "@/store/settingsStore";

export function AudioDiagnosticPage() {
  const settings = useSettingsStore((s) => s.settings);
  const [running, setRunning] = useState(false);
  const [selfTest, setSelfTest] = useState<StackmatPacket[] | null>(null);
  const monitor = useAudioMonitor(running);

  useEffect(() => {
    void audioIsRunning().then(setRunning);
  }, []);

  const start = async () => {
    try {
      await startAudio({
        deviceName: settings.audioDeviceName,
        invert: settings.audioInvert,
        threshold: settings.audioThreshold,
      });
      setRunning(true);
    } catch {
      setRunning(false);
    }
  };

  const stop = async () => {
    await stopAudio();
    setRunning(false);
  };

  const runSelfTest = async () => {
    setSelfTest(await audioSelfTest());
  };

  return (
    <div>
      <h1>Diagnostic audio</h1>
      <p className="muted mb">
        Vérifie la chaîne de décodage et règle ton micro. Le mode debug affiche
        les octets décodés et les valeurs audio simplifiées.
      </p>

      <div className="card mb">
        <div className="row between mb">
          <h3 style={{ margin: 0 }}>Capture</h3>
          {running ? (
            <button className="btn danger" onClick={stop}>
              ⏹ Arrêter
            </button>
          ) : (
            <button className="btn primary" onClick={start}>
              ▶ Démarrer
            </button>
          )}
        </div>
        <SignalMeter
          rms={monitor.level?.rms ?? 0}
          peak={monitor.level?.peak ?? 0}
        />
        <div className="row wrap mt" style={{ gap: 24, fontSize: 13 }}>
          <span>
            RMS :{" "}
            <b className="mono">
              {((monitor.level?.rms ?? 0) * 100).toFixed(1)}%
            </b>
          </span>
          <span>
            Crête :{" "}
            <b className="mono">
              {((monitor.level?.peak ?? 0) * 100).toFixed(1)}%
            </b>
          </span>
          <span>
            Fréq. :{" "}
            <b className="mono">{monitor.level?.sampleRate ?? "—"} Hz</b>
          </span>
          <span>
            Trames :{" "}
            <b className="mono">
              {monitor.validPackets}/{monitor.totalPackets}
            </b>{" "}
            valides
          </span>
        </div>
      </div>

      <div className="card mb">
        <h3>Octets décodés (debug)</h3>
        <div className="debug-bytes">
          {monitor.level?.debugHex || "— en attente de signal —"}
        </div>
        {monitor.lastPacket && (
          <div className="row wrap mt" style={{ gap: 18, fontSize: 13 }}>
            <span>
              État : <b>{monitor.lastPacket.state}</b>
            </span>
            <span>
              Temps :{" "}
              <b className="mono">
                {(monitor.lastPacket.timeMs / 1000).toFixed(2)} s
              </b>
            </span>
            <span>
              En-tête : <b className="mono">{monitor.lastPacket.header}</b>
            </span>
            <span>
              Checksum :{" "}
              <b style={{ color: monitor.lastPacket.validChecksum ? "var(--good)" : "var(--bad)" }}>
                {monitor.lastPacket.validChecksum ? "valide" : "invalide"}
              </b>
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row between mb">
          <h3 style={{ margin: 0 }}>Auto-test (sans micro)</h3>
          <button className="btn" onClick={runSelfTest}>
            ▶ Lancer l'auto-test
          </button>
        </div>
        <p className="hint mb">
          Génère un signal Stackmat synthétique (12.345 s, arrêté) et le décode :
          si l'auto-test réussit, la chaîne de décodage fonctionne et seul le
          réglage du micro est en cause.
        </p>
        {selfTest && (
          <div className="debug-bytes" style={{ color: "var(--text)" }}>
            {selfTest.length === 0
              ? "Échec : aucune trame décodée."
              : selfTest.map((p, i) => (
                  <div key={i}>
                    ✅ état={p.state} temps={(p.timeMs / 1000).toFixed(3)}s
                    checksum={p.validChecksum ? "OK" : "KO"}
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
