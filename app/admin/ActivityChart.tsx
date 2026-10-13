"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatDay } from "@/lib/dates";

export type ActivityPoint = { day: string; active: number };

/** Barras de personas activas por día. Tocar o pasar por encima de una barra muestra su valor. */
export function ActivityChart({ series }: { series: ActivityPoint[] }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState(series.length - 1);
  const max = Math.max(1, ...series.map((p) => p.active));
  const current = series[selected];

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{t.admin.chartTitle}</figcaption>
      <p className="muted min-h-5 text-sm" aria-live="polite">
        {current && t.admin.chartDay(formatDay(current.day, locale), current.active)}
      </p>
      <div className="flex h-32 items-end gap-0.5 border-b border-zinc-200 dark:border-zinc-700" role="list">
        {series.map((p, i) => (
          <button
            key={p.day}
            type="button"
            role="listitem"
            aria-label={t.admin.chartDay(formatDay(p.day, locale), p.active)}
            onMouseEnter={() => setSelected(i)}
            onFocus={() => setSelected(i)}
            onClick={() => setSelected(i)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={`block w-full rounded-t transition-colors ${
                p.active === 0
                  ? "bg-zinc-200 dark:bg-zinc-700"
                  : i === selected
                    ? "bg-violet-800 dark:bg-violet-300"
                    : "bg-violet-600 group-hover:bg-violet-700 dark:bg-violet-500 dark:group-hover:bg-violet-400"
              }`}
              style={{ height: p.active === 0 ? 2 : `${Math.max(4, (p.active / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="muted flex justify-between text-xs">
        <span>{series[0] && formatDay(series[0].day, locale)}</span>
        <span>{series.at(-1) && formatDay(series.at(-1)!.day, locale)}</span>
      </div>
      <details className="text-sm">
        <summary className="muted cursor-pointer text-xs">{t.admin.tableView}</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="muted">
            <tr>
              <th className="py-1 font-medium">{t.admin.day}</th>
              <th className="py-1 text-right font-medium">{t.admin.activeTitle}</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.day} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1">{formatDay(p.day, locale)}</td>
                <td className="py-1 text-right tabular-nums">{p.active}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
