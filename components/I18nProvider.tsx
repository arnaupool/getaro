"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DICTIONARIES, type Locale } from "@/lib/i18n/dictionaries";

const I18nContext = createContext<Locale>("ca");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const locale = useContext(I18nContext);
  return { locale, t: DICTIONARIES[locale] };
}
