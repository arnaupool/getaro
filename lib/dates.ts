import { INTL_LOCALE, type Locale } from "./i18n/dictionaries";

// Las fechas de día se manejan siempre como strings ISO "YYYY-MM-DD" y se
// operan en UTC para que la zona horaria no mueva ningún día.

const DAY_MS = 86_400_000;

export function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return toISO(new Date(toUTC(iso).getTime() + n * DAY_MS));
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / DAY_MS);
}

/** Días entre a y b, ambos incluidos, en orden ascendente (acepta a > b). */
export function daysBetween(a: string, b: string): string[] {
  const [start, end] = a <= b ? [a, b] : [b, a];
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Hoy en la zona horaria local de quien ejecuta. */
export function todayISO(): string {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Lunes = 0 … Domingo = 6 */
export function weekdayMon0(iso: string): number {
  return (toUTC(iso).getUTCDay() + 6) % 7;
}

/** Primer día de cada mes que toca el rango [start, end]. */
export function monthsInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start.slice(0, 7) + "-01";
  while (cur <= end) {
    out.push(cur);
    const d = toUTC(cur);
    cur = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  }
  return out;
}

export function daysInMonth(monthStart: string): string[] {
  const d = toUTC(monthStart);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return daysBetween(monthStart, toISO(last));
}

// ── Formato según idioma ────────────────────────────────────

const FORMATS = {
  short: { weekday: "short", day: "numeric", month: "short" },
  long: { weekday: "long", day: "numeric", month: "long" },
  month: { month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(locale: Locale, kind: keyof typeof FORMATS, iso: string): string {
  const key = `${locale}:${kind}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", ...FORMATS[kind] });
    formatters.set(key, f);
  }
  return f.format(toUTC(iso));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatDay(iso: string, locale: Locale): string {
  return fmt(locale, "short", iso);
}

export function formatDayLong(iso: string, locale: Locale): string {
  return capitalize(fmt(locale, "long", iso));
}

export function formatMonth(iso: string, locale: Locale): string {
  return capitalize(fmt(locale, "month", iso));
}

export function formatRange(start: string, end: string, locale: Locale): string {
  if (start === end) return formatDay(start, locale);
  return `${formatDay(start, locale)} – ${formatDay(end, locale)}`;
}

export function formatRangeCompact(start: string, end: string, locale: Locale): string {
  if (start === end) return fmt(locale, "dayMonth", start);
  return `${fmt(locale, "dayMonth", start)} – ${fmt(locale, "dayMonth", end)}`;
}
