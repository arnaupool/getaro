"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "./I18nProvider";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "ca", label: "Valencià" },
  { value: "es", label: "Castellano" },
];

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={`inline-flex rounded-xl border border-zinc-300 p-1 dark:border-zinc-700 ${pending ? "opacity-60" : ""}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setLocale(o.value))}
          className={`rounded-lg transition ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
            locale === o.value
              ? "bg-violet-600 text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
