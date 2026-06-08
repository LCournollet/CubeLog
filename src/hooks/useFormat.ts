import { useCallback } from "react";

import { formatSolveTime, formatTime } from "@/core/format/time";
import type { TimeFormatOptions } from "@/core/format/time";
import type { Penalty } from "@/core/types";
import { useSettingsStore } from "@/store/settingsStore";

/** Fournit des formateurs de temps respectant les réglages utilisateur. */
export function useFormat() {
  const precision = useSettingsStore((s) => s.settings.precision);
  const alwaysMinutes = useSettingsStore((s) => s.settings.alwaysMinutes);

  const options: TimeFormatOptions = { precision, alwaysMinutes };

  const time = useCallback(
    (ms: number | null) => (ms === null ? "—" : formatTime(ms, options)),
    [precision, alwaysMinutes],
  );

  const solve = useCallback(
    (finalMs: number | null, penalty: Penalty) =>
      formatSolveTime(finalMs, penalty, options),
    [precision, alwaysMinutes],
  );

  return { time, solve };
}
