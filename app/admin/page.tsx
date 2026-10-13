import Link from "next/link";
import { adminDeleteUser, adminSetAdmin, deleteRoom } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireAdmin } from "@/lib/auth";
import { INTL_LOCALE } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  color: string;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  rooms_count: number;
};

type AdminRoom = {
  id: string;
  name: string;
  created_at: string;
  owner: { display_name: string } | null;
  room_members: { count: number }[];
  events: { count: number }[];
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireAdmin();
  const { t, locale } = await getI18n();
  const dateFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "2-digit" });
  const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");
  const { tab = "usuarias" } = await searchParams;
  const supabase = await createClient();

  const [{ data: usersData }, { data: rooms }] = await Promise.all([
    supabase.rpc("admin_list_users"),
    supabase
      .from("rooms")
      .select(
        "id, name, created_at, owner:profiles!rooms_owner_id_fkey(display_name), room_members(count), events(count)",
      )
      .order("created_at", { ascending: false })
      .returns<AdminRoom[]>(),
  ]);
  const users = (usersData ?? []) as AdminUser[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t.admin.title}</h1>
        <p className="muted text-sm">{t.admin.stats(users.length, rooms?.length ?? 0)}</p>
      </div>

      <nav className="flex gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
        {[
          { key: "usuarias", label: t.admin.tabUsers },
          { key: "salas", label: t.admin.tabRooms },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            replace
            className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium ${
              tab === t.key ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "usuarias" ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="muted border-b border-zinc-200 text-left text-xs dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">{t.admin.name}</th>
                <th className="px-4 py-2 font-medium">{t.admin.email}</th>
                <th className="px-4 py-2 font-medium">{t.admin.rooms}</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">{t.admin.lastAccess}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: u.color }} />
                      {u.display_name}
                      {u.is_admin && (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          admin
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="muted px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.rooms_count}</td>
                  <td className="muted px-4 py-2 whitespace-nowrap">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-2">
                    {u.id !== me.id && (
                      <div className="flex justify-end gap-1">
                        <ActionForm action={adminSetAdmin}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="value" value={String(!u.is_admin)} />
                          <SubmitButton
                            className="btn-ghost text-xs whitespace-nowrap"
                            confirm={
                              u.is_admin
                                ? t.admin.confirmRemoveAdmin(u.display_name)
                                : t.admin.confirmMakeAdmin(u.display_name)
                            }
                          >
                            {u.is_admin ? t.admin.removeAdmin : t.admin.makeAdmin}
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={adminDeleteUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <SubmitButton
                            className="btn-ghost text-xs text-rose-600 dark:text-rose-400"
                            confirm={t.admin.confirmDeleteUser(u.display_name, u.email)}
                          >
                            {t.common.delete}
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="muted border-b border-zinc-200 text-left text-xs dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Sala</th>
                <th className="px-4 py-2 font-medium">{t.admin.owner}</th>
                <th className="px-4 py-2 font-medium">{t.admin.people}</th>
                <th className="px-4 py-2 font-medium">{t.admin.events}</th>
                <th className="px-4 py-2 font-medium">{t.admin.created}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(rooms ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <Link href={`/rooms/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="muted px-4 py-2">{r.owner?.display_name ?? "—"}</td>
                  <td className="px-4 py-2">{r.room_members[0]?.count ?? 0}</td>
                  <td className="px-4 py-2">{r.events[0]?.count ?? 0}</td>
                  <td className="muted px-4 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <ActionForm action={deleteRoom}>
                      <input type="hidden" name="roomId" value={r.id} />
                      <input type="hidden" name="redirectTo" value="/admin?tab=salas" />
                      <SubmitButton
                        className="btn-ghost text-xs text-rose-600 dark:text-rose-400"
                        confirm={t.admin.confirmDeleteRoom(r.name)}
                      >
                        {t.common.delete}
                      </SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
