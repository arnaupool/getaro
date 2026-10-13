import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDeleteUser, adminRenameUser, adminSetAdmin, adminSignOutUser } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatTimestamp } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type UserDetail = {
  id: string;
  display_name: string;
  color: string;
  is_admin: boolean;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  active_days_30: number;
  messages_30: number;
  marked_days_30: number;
  events_created: number;
  sessions: number;
  rooms: { id: string; name: string; is_owner: boolean }[];
};

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_user_detail", { uid: id });
  const user = data as UserDetail | null;
  if (!user) notFound();
  const isMe = user.id === me.id;

  const stats = [
    t.admin.activeDays(user.active_days_30),
    t.admin.messages(user.messages_30),
    t.admin.markedDays(user.marked_days_30),
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin?tab=comptes" className="muted text-sm hover:underline">
          {t.admin.back}
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: user.color }} />
          <span className="break-words">{user.display_name}</span>
          {user.is_admin && (
            <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">admin</span>
          )}
        </h1>
        <p className="muted text-sm break-all">{user.email}</p>
      </div>

      <section className="card space-y-1 text-sm">
        <p>
          {t.admin.signedUp}: {formatTimestamp(user.created_at, locale)}
        </p>
        <p>
          {t.admin.lastSignIn}: {user.last_sign_in_at ? formatTimestamp(user.last_sign_in_at, locale) : "–"}
        </p>
        <p>{user.last_active ? t.admin.lastActive(formatDay(user.last_active, locale)) : t.admin.neverActive}</p>
        <p className="muted">{t.admin.sessions(user.sessions)}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">{t.admin.last30Title}</h2>
        <ul className="grid grid-cols-3 gap-2 text-center">
          {stats.map((s) => (
            <li key={s} className="rounded-xl bg-zinc-50 px-2 py-2 text-sm dark:bg-zinc-800/50">
              {s}
            </li>
          ))}
        </ul>
        <p className="muted text-xs">{t.admin.eventsCreated(user.events_created)}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">{t.admin.tabRooms}</h2>
        {user.rooms.length === 0 ? (
          <p className="muted text-sm">{t.admin.noRooms}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {user.rooms.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/rooms/${r.id}`}
                  className="badge bg-zinc-100 px-3 py-1 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {r.name}
                  {r.is_owner && <span className="ml-1 text-violet-600 dark:text-violet-400">·{t.admin.owner}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <ActionForm action={adminRenameUser} className="space-y-2">
          <input type="hidden" name="userId" value={user.id} />
          <label className="label" htmlFor="name">
            {t.admin.rename}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="name"
              name="name"
              required
              maxLength={40}
              defaultValue={user.display_name}
              className="input sm:max-w-xs"
            />
            <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
          </div>
        </ActionForm>

        {isMe ? (
          <p className="muted text-sm">{t.admin.you}</p>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <ActionForm action={adminSetAdmin}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="value" value={String(!user.is_admin)} />
              <SubmitButton
                className="btn-secondary"
                confirm={
                  user.is_admin
                    ? t.admin.confirmRemoveAdmin(user.display_name)
                    : t.admin.confirmMakeAdmin(user.display_name)
                }
              >
                {user.is_admin ? t.admin.removeAdmin : t.admin.makeAdmin}
              </SubmitButton>
            </ActionForm>
            <ActionForm action={adminSignOutUser}>
              <input type="hidden" name="userId" value={user.id} />
              <SubmitButton className="btn-secondary" confirm={t.admin.confirmSignOut(user.display_name)}>
                {t.admin.signOut}
              </SubmitButton>
            </ActionForm>
            <ActionForm action={adminDeleteUser}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="redirectTo" value="/admin?tab=comptes" />
              <SubmitButton className="btn-danger" confirm={t.admin.confirmDeleteUser(user.display_name, user.email)}>
                {t.admin.deleteAccount}
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </section>
    </div>
  );
}
