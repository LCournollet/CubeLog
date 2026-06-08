import { useEffect, useState } from "react";

import { MainPage } from "@/pages/MainPage";
import { StatsPage } from "@/pages/StatsPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { TimerConnectPage } from "@/pages/TimerConnectPage";
import { AudioDiagnosticPage } from "@/pages/AudioDiagnosticPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useAppStore } from "@/store/appStore";
import { useSettingsStore } from "@/store/settingsStore";

export type Page =
  | "main"
  | "stats"
  | "sessions"
  | "connect"
  | "diagnostic"
  | "settings";

const NAV: Array<{ page: Page; label: string; icon: string }> = [
  { page: "main", label: "Timer", icon: "⏱" },
  { page: "stats", label: "Statistiques", icon: "📊" },
  { page: "sessions", label: "Sessions", icon: "🗂" },
  { page: "connect", label: "Connexion timer", icon: "🎙" },
  { page: "diagnostic", label: "Diagnostic audio", icon: "🩺" },
  { page: "settings", label: "Paramètres", icon: "⚙" },
];

export default function App() {
  const [page, setPage] = useState<Page>("main");
  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const theme = useSettingsStore((s) => s.settings.theme);
  const timerMode = useSettingsStore((s) => s.settings.timerMode);
  const init = useAppStore((s) => s.init);

  // Chargement initial.
  useEffect(() => {
    void loadSettings();
    void init();
  }, [loadSettings, init]);

  // Application du thème.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (!settingsLoaded) {
    return (
      <div
        style={{
          height: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--text-dim)",
        }}
      >
        Chargement…
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <CubeLogo />
          CubeLog
        </div>
        {NAV.map((n) => (
          <button
            key={n.page}
            className={`nav-item ${page === n.page ? "active" : ""}`}
            onClick={() => setPage(n.page)}
          >
            <span style={{ width: 18, textAlign: "center" }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div className="nav-spacer" />
        <div className="nav-status">
          <span
            className={`dot ${timerMode === "external" ? "accent" : "good"}`}
          />
          Mode :{" "}
          {timerMode === "external"
            ? "Timer externe"
            : timerMode === "keyboard"
              ? "Clavier"
              : "Manuel"}
        </div>
      </aside>

      <main className="content">
        {page === "main" && <MainPage onNavigate={setPage} />}
        {page === "stats" && <StatsPage />}
        {page === "sessions" && <SessionsPage />}
        {page === "connect" && <TimerConnectPage />}
        {page === "diagnostic" && <AudioDiagnosticPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function CubeLogo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#5b8cff" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="#3ecf8e" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="#f5b14c" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#f06363" />
    </svg>
  );
}
