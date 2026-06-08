import { Switch } from "@/components/Switch";
import { useSettingsStore } from "@/store/settingsStore";

export function SettingsPage() {
  const s = useSettingsStore((st) => st.settings);
  const update = useSettingsStore((st) => st.update);

  return (
    <div>
      <h1>Paramètres</h1>

      <div className="card mb">
        <h3>Apparence</h3>
        <Row label="Thème" hint="Sombre ou clair.">
          <select
            className="select"
            value={s.theme}
            onChange={(e) => update({ theme: e.target.value as "dark" | "light" })}
          >
            <option value="dark">Sombre</option>
            <option value="light">Clair</option>
          </select>
        </Row>
        <Row label="Taille du mélange">
          <select
            className="select"
            value={s.scrambleSize}
            onChange={(e) =>
              update({ scrambleSize: e.target.value as typeof s.scrambleSize })
            }
          >
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
          </select>
        </Row>
      </div>

      <div className="card mb">
        <h3>Format des temps</h3>
        <Row label="Précision" hint="12.34 ou 12.345.">
          <select
            className="select"
            value={s.precision}
            onChange={(e) =>
              update({ precision: parseInt(e.target.value, 10) as 2 | 3 })
            }
          >
            <option value={2}>2 décimales (12.34)</option>
            <option value={3}>3 décimales (12.345)</option>
          </select>
        </Row>
        <Row label="Toujours afficher les minutes">
          <Switch
            checked={s.alwaysMinutes}
            onChange={(v) => update({ alwaysMinutes: v })}
          />
        </Row>
      </div>

      <div className="card mb">
        <h3>Aide débutant</h3>
        <Row label="Activer l'aide débutant" hint="Affiche les flèches à côté de la notation technique.">
          <Switch
            checked={s.beginnerEnabled}
            onChange={(v) => update({ beginnerEnabled: v })}
          />
        </Row>
        <Row label="Mode d'affichage">
          <select
            className="select"
            value={s.beginnerMode}
            onChange={(e) =>
              update({ beginnerMode: e.target.value as typeof s.beginnerMode })
            }
          >
            <option value="compact">Compact (flèches)</option>
            <option value="detailed">Détaillé (flèches + texte)</option>
          </select>
        </Row>
        <Row label="Flèches seules (mode détaillé)" hint="Masque les explications, ne garde que la face et la flèche.">
          <Switch
            checked={s.beginnerArrowsOnly}
            onChange={(v) => update({ beginnerArrowsOnly: v })}
          />
        </Row>
      </div>

      <div className="card mb">
        <h3>Inspection WCA</h3>
        <Row label="Activer l'inspection" hint="Compte à rebours de 15 s avant le départ (mode clavier).">
          <Switch
            checked={s.inspectionEnabled}
            onChange={(v) => update({ inspectionEnabled: v })}
          />
        </Row>
        <Row label="Durée d'inspection (s)">
          <input
            className="input"
            type="number"
            min={5}
            max={60}
            value={s.inspectionSeconds}
            onChange={(e) =>
              update({ inspectionSeconds: parseInt(e.target.value, 10) || 15 })
            }
            style={{ width: 90 }}
          />
        </Row>
      </div>

      <div className="card mb">
        <h3>Clavier</h3>
        <Row label={`Maintien avant départ : ${s.holdToStartMs} ms`} hint="Durée de maintien de la barre Espace avant d'être « prêt ».">
          <input
            type="range"
            min={0}
            max={1000}
            step={50}
            value={s.holdToStartMs}
            onChange={(e) =>
              update({ holdToStartMs: parseInt(e.target.value, 10) })
            }
          />
        </Row>
      </div>

      <div className="card mb">
        <h3>Audio / Timer externe</h3>
        <Row label={`Seuil de décodage : ${s.audioThreshold.toFixed(2)}`}>
          <input
            type="range"
            min={0.05}
            max={0.6}
            step={0.01}
            value={s.audioThreshold}
            onChange={(e) =>
              update({ audioThreshold: parseFloat(e.target.value) })
            }
          />
        </Row>
        <Row
          label={`Compensation de latence : ${s.externalLeadMs} ms`}
          hint="Aligne le chrono à l'écran sur ton timer physique. Augmente si l'affichage est en retard. N'affecte pas le temps enregistré."
        >
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={s.externalLeadMs}
            onChange={(e) =>
              update({ externalLeadMs: parseInt(e.target.value, 10) })
            }
          />
        </Row>
        <Row label={`Anti-rebond : ${s.debounceMs} ms`} hint="Délai minimal entre deux enregistrements pour éviter les doublons.">
          <input
            type="range"
            min={0}
            max={2000}
            step={50}
            value={s.debounceMs}
            onChange={(e) =>
              update({ debounceMs: parseInt(e.target.value, 10) })
            }
          />
        </Row>
      </div>

      <div className="card">
        <h3>Divers</h3>
        <Row label="Sons">
          <Switch
            checked={s.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
          />
        </Row>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-row">
      <div>
        <div className="label">{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {children}
      </div>
    </div>
  );
}
