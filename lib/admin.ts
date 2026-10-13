import { supabaseConfig } from "./config";
import type { Dict, Locale } from "./i18n/dictionaries";
import { INTL_LOCALE } from "./i18n/dictionaries";

export type AuditRow = {
  id: number;
  at: string;
  actor_id: string | null;
  action: string;
  room_id: string | null;
  target_user_id: string | null;
  details: {
    actor_name?: string;
    room_name?: string;
    target_name?: string;
    from_name?: string;
    event_title?: string;
  };
};

export const AUDIT_CATEGORIES = {
  rooms: ["room_deleted", "owner_changed", "event_deleted"],
  people: ["member_removed", "member_left", "request_accepted", "request_rejected"],
  accounts: ["account_deleted", "admin_granted", "admin_revoked", "renamed_by_admin", "sessions_revoked"],
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

export function isAuditCategory(v: unknown): v is AuditCategory {
  return typeof v === "string" && Object.hasOwn(AUDIT_CATEGORIES, v);
}

/** Frase legible de una entrada del historial: "Marta ha tret Laura de «Les del divendres»" */
export function describeAudit(row: AuditRow, t: Dict): string {
  const template = Object.hasOwn(t.admin.log, row.action) ? t.admin.log[row.action] : row.action;
  const d = row.details;
  const values: Record<string, string> = {
    a: d.actor_name ?? (row.actor_id ? t.admin.someone : t.admin.system),
    t: d.target_name ?? t.admin.someone,
    r: d.room_name ?? "?",
    from: d.from_name ?? "?",
    e: d.event_title ?? "?",
  };
  const text = template.replace(/\{(a|t|r|from|e)\}/g, (_, key: string) => values[key]);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Fecha y hora cortas en la zona de España: "13 d'oct., 21:05" */
export function formatTimestamp(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

/** ¿Responde Supabase y cuánto tarda? (para la pestaña Sistema) */
export async function checkSupabaseHealth(): Promise<{ ok: boolean; ms: number }> {
  const { url, key } = supabaseConfig();
  const started = performance.now();
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, ms: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, ms: 0 };
  }
}
