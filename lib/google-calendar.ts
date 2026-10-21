import { addDays } from "./dates";

/** Duración por defecto cuando la quedada tiene hora pero no hora de fin */
const DEFAULT_DURATION_MINUTES = 120;
const TIME_ZONE = "Europe/Madrid";

type GoogleCalendarEvent = {
  title: string;
  /** Días "YYYY-MM-DD" de la fecha elegida (iguales si es un solo día) */
  start: string;
  end: string;
  /** "HH:MM" o "HH:MM:SS"; sin hora, el evento es de día completo */
  time: string | null;
  location: string | null;
  details: string;
};

const compactDate = (iso: string) => iso.replaceAll("-", "");

/** "YYYYMMDDTHHMMSS" en hora local (Google la interpreta con ctz) */
function localStamp(day: string, time: string, plusMinutes = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, h, mi + plusMinutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
  );
}

/**
 * Enlace que abre Google Calendar con el evento ya rellenado; la persona solo pulsa Guardar.
 * Sin hora: evento de día completo (Google usa el día final exclusivo). Con hora: empieza ese día a esa hora y dura
 * 2 horas desde la hora del último día.
 */
export function googleCalendarUrl(event: GoogleCalendarEvent): string {
  const dates = event.time
    ? `${localStamp(event.start, event.time)}/${localStamp(event.end, event.time, DEFAULT_DURATION_MINUTES)}`
    : `${compactDate(event.start)}/${compactDate(addDays(event.end, 1))}`;

  const params: [string, string][] = [
    ["action", "TEMPLATE"],
    ["text", event.title],
    ["dates", dates],
    ["details", event.details],
  ];
  if (event.location) params.push(["location", event.location]);
  if (event.time) params.push(["ctz", TIME_ZONE]);

  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `https://calendar.google.com/calendar/render?${query}`;
}
