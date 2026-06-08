import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatTime } from "@/core/format/time";
import { buildDistribution, buildTimeSeries } from "@/core/stats/series";
import { computeSessionStats } from "@/core/stats/statistics";
import type { StatResult } from "@/core/stats/types";
import { useFormat } from "@/hooks/useFormat";
import { useAppStore } from "@/store/appStore";

export function StatsPage() {
  const { time } = useFormat();
  const sessions = useAppStore((s) => s.sessions);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const selectSession = useAppStore((s) => s.selectSession);
  const allSolves = useAppStore((s) => s.solves);

  const [limit, setLimit] = useState<"all" | "100" | "50">("all");

  const solves = useMemo(() => {
    if (limit === "all") return allSolves;
    const n = parseInt(limit, 10);
    return allSolves.slice(Math.max(0, allSolves.length - n));
  }, [allSolves, limit]);

  const stats = useMemo(() => computeSessionStats(solves), [solves]);
  const series = useMemo(() => buildTimeSeries(solves), [solves]);
  const distribution = useMemo(() => buildDistribution(solves), [solves]);

  const fmt = (r: StatResult) => (r.isDnf ? "DNF" : time(r.value));
  // Axe/tooltip : secondes avec 1 décimale (compact), minutes si nécessaire.
  const axisFmt = (v: number) =>
    v >= 60000 ? formatTime(v, { precision: 1 }) : (v / 1000).toFixed(1);

  const kpis: Array<[string, string]> = [
    ["Solves", String(stats.count)],
    ["Meilleur", fmt(stats.bestSingle)],
    ["Pire", fmt(stats.worstSingle)],
    ["Moyenne", fmt(stats.mean)],
    ["Ao5", fmt(stats.current[5])],
    ["Ao12", fmt(stats.current[12])],
    ["Ao50", fmt(stats.current[50])],
    ["Ao100", fmt(stats.current[100])],
    ["Best Ao5", fmt(stats.best[5])],
    ["Best Ao12", fmt(stats.best[12])],
    ["DNF", `${stats.dnfCount} (${Math.round(stats.dnfRate * 100)}%)`],
  ];

  return (
    <div>
      <div className="row between mb">
        <h1>Statistiques</h1>
        <div className="row gap-sm">
          <select
            className="select"
            value={currentSessionId ?? ""}
            onChange={(e) => selectSession(Number(e.target.value))}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={limit}
            onChange={(e) => setLimit(e.target.value as typeof limit)}
          >
            <option value="all">Tout</option>
            <option value="100">100 derniers</option>
            <option value="50">50 derniers</option>
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <div className="k-label">{label}</div>
            <div className="k-value">{value}</div>
          </div>
        ))}
      </div>

      {solves.length === 0 ? (
        <div className="card">
          <p className="muted">
            Pas encore de données. Enregistre quelques solves pour voir les
            graphiques.
          </p>
        </div>
      ) : (
        <>
          <div className="card chart-card">
            <h2>Évolution des temps</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="index" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis
                    tickFormatter={axisFmt}
                    stroke="var(--text-faint)"
                    fontSize={11}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: number) => axisFmt(v)}
                    contentStyle={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="single"
                    stroke="var(--accent)"
                    dot={false}
                    strokeWidth={1.5}
                    name="Single"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="ao5"
                    stroke="var(--good)"
                    dot={false}
                    strokeWidth={1.5}
                    name="Ao5"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="ao12"
                    stroke="var(--warn)"
                    dot={false}
                    strokeWidth={1.5}
                    name="Ao12"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h2>Distribution des temps</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="var(--text-faint)" fontSize={11} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" name="Solves" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
