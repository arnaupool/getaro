import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, DICTIONARIES, isLocale, LOCALE_COOKIE, type Locale } from "./dictionaries";

/** Idioma de la petición (cookie `lang`, valencià por defecto) y sus textos. */
export const getI18n = cache(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return { locale, t: DICTIONARIES[locale] };
});
