import { useMemo } from "react";

import { computeSessionStats } from "@/core/stats/statistics";
import type { StatResult } from "@/core/stats/types";
import type { Solve } from "@/core/types";
import { useFormat } from "@/hooks/useFormat";

interface QuickStatsProps {
  solves: Solve[];
}

/** Bloc de statistiques essentielles affiché à côté du timer. */
export function QuickStats({ solves }: QuickStatsProps) {
  const { time } = useFormat();
  const stats = useMemo(() => computeSessionStats(solves), [solves]);

  const fmt = (r: StatResult) => (r.isDnf ? "DNF" : time(r.value));

  const cells: Array<[string, string]> = [
    ["Dernier", fmt(stats.lastSingle)],
    ["Meilleur", fmt(stats.bestSingle)],
    ["Ao5", fmt(stats.current[5])],
    ["Ao12", fmt(stats.current[12])],
    ["Ao50", fmt(stats.current[50])],
    ["Ao100", fmt(stats.current[100])],
    ["Moyenne", fmt(stats.mean)],
    ["Solves", String(stats.count)],
  ];

  return (
    <div className="card">
      <div className="row between mb">
        <h3 style={{ margin: 0 }}>Statistiques</h3>
        <span className="faint" style={{ fontSize: 12 }}>
          {stats.dnfCount > 0
            ? `${stats.dnfCount} DNF (${Math.round(stats.dnfRate * 100)}%)`
            : "0 DNF"}
        </span>
      </div>
      <div className="stat-grid">
        {cells.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
