"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; icon: string }[] = [
  { value: "light", icon: "☀️" },
  { value: "dark", icon: "🌙" },
  { value: "system", icon: "💻" },
];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** Botón compacto (cabecera): alterna claro ↔ oscuro */
export function ThemeToggle() {
  const { t } = useI18n();
  const toggle = () => {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch {}
    apply(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost"
      aria-label={t.header.toggleTheme}
      title={t.header.toggleTheme}
    >
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}

/** Selector completo (ajustes): claro / oscuro / sistema */
export function ThemeSelect() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en cliente
    setTheme(readTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readTheme() === "system" && apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
    apply(t);
  };

  return (
    <div className="inline-flex rounded-xl border border-zinc-300 p-1 dark:border-zinc-700">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            theme === o.value
              ? "bg-violet-600 text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {o.icon} {t.theme[o.value]}
        </button>
      ))}
    </div>
  );
}
