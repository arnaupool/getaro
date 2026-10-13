"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatDay } from "@/lib/dates";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  color: string;
  is_admin: boolean;
  created_at: string;
  last_active: string | null;
  rooms_count: number;
};

/** Lista de cuentas en tarjetas con buscador por nombre o correo */
export function UserList({ users }: { users: AdminUser[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => u.display_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.admin.search}
        className="input"
        aria-label={t.admin.search}
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((u) => (
          <li key={u.id}>
            <Link
              href={`/admin/users/${u.id}`}
              className="card flex items-start gap-3 py-3 transition hover:border-violet-400"
            >
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: u.color }} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words">{u.display_name}</span>
                  {u.is_admin && (
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      admin
                    </span>
                  )}
                </span>
                <span className="muted block text-sm break-all">{u.email}</span>
                <span className="muted block text-xs">
                  {t.admin.roomsCount(u.rooms_count)} ·{" "}
                  {u.last_active ? t.admin.lastActive(formatDay(u.last_active, locale)) : t.admin.neverActive}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
