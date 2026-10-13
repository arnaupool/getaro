import { addDays, daysBetween } from "./dates";
import type { AvailabilityRow, AvailabilityStatus } from "./types";

export type DaySummary = {
  day: string;
  yes: string[];
  maybe: string[];
};

export type DayLevel = "all-yes" | "all-maybe" | "partial" | "none";

export type Window = {
  start: string;
  end: string;
  days: number;
  /** Cuántas personas pueden (sí o quizás) en el peor día de la racha */
  minAvailable: number;
  /** Días de la racha en los que todas dicen "sí" */
  allYesDays: number;
};

/** Clic en un día: vacío → sí → quizás → vacío */
export function nextStatus(current: AvailabilityStatus | undefined): AvailabilityStatus | null {
  if (!current) return "yes";
  if (current === "yes") return "maybe";
  return null;
}

export function summarize(rows: AvailabilityRow[], days: string[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>(days.map((d) => [d, { day: d, yes: [], maybe: [] }]));
  for (const r of rows) {
    const s = map.get(r.day);
    if (!s) continue;
    (r.status === "yes" ? s.yes : s.maybe).push(r.user_id);
  }
  return map;
}

export function dayLevel(s: DaySummary | undefined, memberCount: number): DayLevel {
  if (!s || memberCount === 0) return "none";
  const available = s.yes.length + s.maybe.length;
  if (available === 0) return "none";
  if (s.yes.length === memberCount) return "all-yes";
  if (available === memberCount) return "all-maybe";
  return "partial";
}

/** 0..1 — "quizás" cuenta la mitad */
export function dayScore(s: DaySummary | undefined, memberCount: number): number {
  if (!s || memberCount === 0) return 0;
  return (s.yes.length + s.maybe.length * 0.5) / memberCount;
}

/**
 * Mejores fechas: rachas de días consecutivos en las que puede el máximo de gente
 * (sí + quizás). Si nadie coincide del todo, el umbral baja al máximo alcanzado.
 */
export function bestWindows(
  summaries: Map<string, DaySummary>,
  selectable: string[],
  memberCount: number,
  limit = 5,
): Window[] {
  if (memberCount === 0 || selectable.length === 0) return [];

  const available = (d: string) => {
    const s = summaries.get(d);
    return s ? s.yes.length + s.maybe.length : 0;
  };

  const maxAvail = Math.max(...selectable.map(available));
  if (maxAvail === 0) return [];

  const windows: Window[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    windows.push({
      start: run[0],
      end: run[run.length - 1],
      days: run.length,
      minAvailable: Math.min(...run.map(available)),
      allYesDays: run.filter((d) => summaries.get(d)?.yes.length === memberCount).length,
    });
    run = [];
  };

  for (const d of selectable) {
    if (run.length > 0 && addDays(run[run.length - 1], 1) !== d) flush();
    if (available(d) >= maxAvail) run.push(d);
    else flush();
  }
  flush();

  return windows
    .sort((a, b) => b.days - a.days || b.allYesDays / b.days - a.allYesDays / a.days || a.start.localeCompare(b.start))
    .slice(0, limit);
}

/** Días marcables de un evento: dentro del rango y desde hoy. */
export function selectableDays(start: string, end: string, today: string): string[] {
  if (end < today) return [];
  return daysBetween(start < today ? today : start, end);
}
