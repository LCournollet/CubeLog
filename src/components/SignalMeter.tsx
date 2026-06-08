interface SignalMeterProps {
  /** Niveau RMS 0..1. */
  rms: number;
  /** Crête 0..1. */
  peak: number;
}

/** Vumètre simple pour le signal audio. */
export function SignalMeter({ rms, peak }: SignalMeterProps) {
  const pct = Math.min(100, Math.round(rms * 140));
  const peakPct = Math.min(100, Math.round(peak * 140));
  return (
    <div className="meter" title={`RMS ${(rms * 100).toFixed(1)}%`}>
      <div className="fill" style={{ width: `${pct}%` }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${peakPct}%`,
          width: 2,
          height: "100%",
          background: "var(--text)",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
