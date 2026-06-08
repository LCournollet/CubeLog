import { useEffect, useState } from "react";

import {
  audioIsRunning,
  listAudioDevices,
  startAudio,
  stopAudio,
} from "@/api/commands";
import type { AudioDevice } from "@/api/types";
import { SignalMeter } from "@/components/SignalMeter";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useSettingsStore } from "@/store/settingsStore";

const STATE_LABEL: Record<string, string> = {
  idle: "Au repos",
  ready: "Prêt (mains posées)",
  running: "En cours",
  stopped: "Arrêté",
  unknown: "Inconnu",
};

export function TimerConnectPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monitor = useAudioMonitor(running);

  const refreshDevices = async () => {
    try {
      const list = await listAudioDevices();
      setDevices(list);
      // Sélectionne le périphérique par défaut si rien n'est choisi.
      if (!settings.audioDeviceName) {
        const def = list.find((d) => d.isDefault) ?? list[0];
        if (def) await update({ audioDeviceName: def.name });
      }
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    void refreshDevices();
    void audioIsRunning().then(setRunning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    try {
      await startAudio({
        deviceName: settings.audioDeviceName,
        invert: settings.audioInvert,
        threshold: settings.audioThreshold,
      });
      setRunning(true);
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  };

  const stop = async () => {
    await stopAudio();
    setRunning(false);
  };

  // Redémarre la capture quand un paramètre de décodage change (si active).
  const restartIfRunning = async () => {
    if (running) {
      await stopAudio();
      await start();
    }
  };

  const calibrate = async () => {
    // La polarité est auto-détectée par le décodeur : la calibration se limite
    // à remettre le seuil à une valeur éprouvée puis à relancer la capture.
    await update({ audioThreshold: 0.22 });
    await restartIfRunning();
  };

  const state = monitor.lastPacket?.state ?? monitor.level?.lastState ?? "idle";

  return (
    <div>
      <h1>Connexion timer</h1>
      <p className="muted mb">
        Branche le jack de ton timer QiYi / QY Toys sur l'entrée micro, puis
        démarre la capture.
      </p>

      <div className="card mb">
        <h3>Périphérique d'entrée</h3>
        <div className="row gap-sm wrap">
          <select
            className="select grow"
            value={settings.audioDeviceName ?? ""}
            onChange={(e) => update({ audioDeviceName: e.target.value })}
          >
            {devices.length === 0 && <option value="">Aucun périphérique</option>}
            {devices.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
                {d.isDefault ? " (défaut)" : ""}
                {d.defaultSampleRate ? ` — ${d.defaultSampleRate} Hz` : ""}
              </option>
            ))}
          </select>
          <button className="btn" onClick={refreshDevices}>
            ↻ Rafraîchir
          </button>
          {running ? (
            <button className="btn danger" onClick={stop}>
              ⏹ Arrêter
            </button>
          ) : (
            <button className="btn primary" onClick={start}>
              ▶ Démarrer la capture
            </button>
          )}
        </div>
        {error && (
          <p className="hint mt" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="card mb">
        <h3>Signal en temps réel</h3>
        <div className="mb">
          <SignalMeter
            rms={monitor.level?.rms ?? 0}
            peak={monitor.level?.peak ?? 0}
          />
        </div>
        <div className="row wrap" style={{ gap: 18 }}>
          <Indicator
            label="État"
            value={STATE_LABEL[state] ?? state}
            tone={state === "running" ? "accent" : "good"}
          />
          <Indicator
            label="Timer détecté"
            value={monitor.timerDetected ? "Oui" : "Non"}
            tone={monitor.timerDetected ? "good" : "bad"}
          />
          <Indicator
            label="Qualité décodage"
            value={`${Math.round(monitor.quality * 100)}%`}
            tone={
              monitor.quality > 0.8
                ? "good"
                : monitor.quality > 0.4
                  ? "warn"
                  : "bad"
            }
          />
          <Indicator
            label="Dernier temps"
            value={
              monitor.lastPacket
                ? `${(monitor.lastPacket.timeMs / 1000).toFixed(2)} s`
                : "—"
            }
            tone="good"
          />
        </div>
      </div>

      <div className="card">
        <h3>Réglages de décodage</h3>
        <div className="form-row">
          <div>
            <div className="label">Polarité du signal</div>
            <div className="hint">
              Auto-détectée — le décodeur teste les deux sens en parallèle, tu
              n'as rien à régler.
            </div>
          </div>
          <span className="pill">
            <span className="dot good" /> automatique
          </span>
        </div>
        <div className="form-row">
          <div>
            <div className="label">
              Seuil / sensibilité : {settings.audioThreshold.toFixed(2)}
            </div>
            <div className="hint">
              Plus bas = plus sensible. 0,20–0,30 convient en général.
            </div>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.6}
            step={0.01}
            value={settings.audioThreshold}
            onChange={(e) =>
              update({ audioThreshold: parseFloat(e.target.value) })
            }
            onMouseUp={restartIfRunning}
          />
        </div>
        <div className="btn-row mt">
          <button className="btn primary" onClick={calibrate}>
            🎚 Calibrer
          </button>
          <span className="hint" style={{ alignSelf: "center" }}>
            Lance une résolution sur le timer pendant la calibration pour de
            meilleurs résultats.
          </span>
        </div>
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "accent";
}) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 11, textTransform: "uppercase" }}>
        {label}
      </div>
      <div className="row gap-sm" style={{ marginTop: 4 }}>
        <span className={`dot ${tone}`} />
        <span style={{ fontWeight: 600 }}>{value}</span>
      </div>
    </div>
  );
}
