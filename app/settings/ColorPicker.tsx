"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";

const PRESETS = [
  "#e11d48",
  "#db2777",
  "#c026d3",
  "#9333ea",
  "#6366f1",
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#78716c",
];

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const { t } = useI18n();
  const [color, setColor] = useState(defaultValue);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={color} />
      {PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setColor(c)}
          aria-label={`Color ${c}`}
          className={`h-8 w-8 rounded-full transition ${
            color.toLowerCase() === c
              ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900"
              : ""
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label
        className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-zinc-400"
        title={t.settings.otherColor}
        aria-label={t.settings.otherColor}
      >
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span className="flex h-full items-center justify-center text-xs">＋</span>
      </label>
      <span className="ml-2 flex items-center gap-2 text-sm">
        <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
        <code className="muted">{color}</code>
      </span>
    </div>
  );
}
