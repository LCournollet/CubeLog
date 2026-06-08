import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";

import {
  exportData,
  importData,
  readTextFile,
  saveTextFile,
} from "@/api/commands";
import type { PuzzleType } from "@/core/types";
import { PUZZLES } from "@/core/types";
import { useAppStore } from "@/store/appStore";

export function SessionsPage() {
  const sessions = useAppStore((s) => s.sessions);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const createSession = useAppStore((s) => s.createSession);
  const renameSession = useAppStore((s) => s.renameSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const init = useAppStore((s) => s.init);

  const [name, setName] = useState("");
  const [puzzle, setPuzzle] = useState<PuzzleType>("333");
  const [status, setStatus] = useState<string | null>(null);

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    await createSession(n, puzzle);
    setName("");
  };

  const rename = async (id: number, current: string) => {
    const next = window.prompt("Nouveau nom de la session", current);
    if (next && next.trim()) await renameSession(id, next.trim());
  };

  const remove = async (id: number, current: string) => {
    if (
      window.confirm(
        `Supprimer la session « ${current} » et tous ses solves ? Cette action est irréversible.`,
      )
    ) {
      await deleteSession(id);
    }
  };

  const doExport = async (format: "json" | "csv", sessionId: number | null) => {
    try {
      const content = await exportData(format, sessionId);
      const path = await save({
        defaultPath: `cubelog-export.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (path) {
        await saveTextFile(path, content);
        setStatus(`Export réussi : ${path}`);
      }
    } catch (e) {
      setStatus(`Erreur d'export : ${String(e)}`);
    }
  };

  const doImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (typeof path === "string") {
        const json = await readTextFile(path);
        const count = await importData(json);
        await init();
        setStatus(`${count} solve(s) importé(s).`);
      }
    } catch (e) {
      setStatus(`Erreur d'import : ${String(e)}`);
    }
  };

  return (
    <div>
      <h1>Sessions</h1>
      <p className="muted mb">
        Organise tes solves par contexte : 3x3 entraînement, OH, compétition
        maison…
      </p>

      <div className="card mb">
        <h3>Nouvelle session</h3>
        <div className="row gap-sm wrap">
          <input
            className="input grow"
            placeholder="Nom de la session"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <select
            className="select"
            value={puzzle}
            onChange={(e) => setPuzzle(e.target.value as PuzzleType)}
          >
            {Object.values(PUZZLES).map((p) => (
              <option key={p.type} value={p.type}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={create}>
            Créer
          </button>
        </div>
      </div>

      <div className="card mb">
        <h3>Mes sessions</h3>
        {sessions.map((s) => (
          <div className="form-row" key={s.id}>
            <div>
              <div className="label">
                {s.name}{" "}
                {s.id === currentSessionId && (
                  <span className="pill">active</span>
                )}
              </div>
              <div className="hint">
                {PUZZLES[s.puzzle]?.label ?? s.puzzle} · {s.solveCount ?? 0}{" "}
                solves · créée le{" "}
                {new Date(s.createdAt).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => selectSession(s.id)}>
                Activer
              </button>
              <button className="btn ghost" onClick={() => rename(s.id, s.name)}>
                Renommer
              </button>
              <button
                className="btn danger"
                onClick={() => remove(s.id, s.name)}
                disabled={sessions.length <= 1}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Import / Export</h3>
        <p className="hint mb">
          Les exports incluent temps, pénalités, mélanges, dates, sessions et
          notes.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => doExport("json", null)}>
            Exporter tout (JSON)
          </button>
          <button className="btn" onClick={() => doExport("csv", null)}>
            Exporter tout (CSV)
          </button>
          <button
            className="btn"
            onClick={() => doExport("json", currentSessionId)}
          >
            Exporter la session active (JSON)
          </button>
          <button className="btn primary" onClick={doImport}>
            Importer (JSON)
          </button>
        </div>
        {status && (
          <p className="hint mt" style={{ color: "var(--good)" }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
