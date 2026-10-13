"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "./I18nProvider";

const OPTIONS: { value: Locale; short: string; label: string }[] = [
  { value: "ca", short: "VA", label: "Valencià" },
  { value: "es", short: "ES", label: "Castellano" },
];

/** Selector compacto de idioma para la cabecera (junto al de tema) */
export function LanguageSelect() {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Idioma"
      className={`inline-flex rounded-lg border border-zinc-300 p-0.5 text-[11px] font-semibold dark:border-zinc-700 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-pressed={locale === o.value}
          disabled={pending}
          onClick={() => locale !== o.value && startTransition(() => setLocale(o.value))}
          className={`rounded-md px-1.5 py-0.5 transition ${
            locale === o.value
              ? "bg-violet-600 text-white"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
