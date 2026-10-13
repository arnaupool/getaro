import Link from "next/link";
import { adminTransferRoom, deleteRoom } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatTimestamp } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { formatRange, formatRangeCompact } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { getRoomContext } from "@/lib/room";
import { createClient } from "@/lib/supabase/server";
import type { RoomEvent } from "@/lib/types";

export default async function AdminRoomPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { t, locale } = await getI18n();
  const { room, members, requests } = await getRoomContext(id);
  const supabase = await createClient();

  const [{ data: events }, { data: statsData }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("room_id", id)
      .order("start_date", { ascending: false })
      .returns<RoomEvent[]>(),
    supabase.rpc("admin_room_stats", { rid: id }),
  ]);
  const stats = statsData as { messages_30: number; last_message_at: string | null } | null;
  const owner = members.find((m) => m.id === room.owner_id);
  const others = members.filter((m) => m.id !== room.owner_id);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin?tab=sales" className="muted text-sm hover:underline">
          {t.admin.back}
        </Link>
        <h1 className="text-2xl font-bold break-words">{room.name}</h1>
        <p className="muted text-sm">
          {t.admin.owner}: {owner?.display_name ?? "–"}
        </p>
      </div>

      <section className="card space-y-1 text-sm">
        <p>{t.admin.chat30(stats?.messages_30 ?? 0)}</p>
        <p className="muted">
          {stats?.last_message_at
            ? t.admin.lastMessage(formatTimestamp(stats.last_message_at, locale))
            : t.admin.noMessages}
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">
          {t.admin.members} ({members.length})
        </h2>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/users/${m.id}`}
                className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-3 pl-0.5 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <Avatar member={m} size="sm" />
                {m.display_name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {requests.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">
            {t.admin.requests} ({requests.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {requests.map(({ member }) => (
              <li key={member.id} className="flex items-center gap-1 text-sm">
                <Avatar member={member} size="sm" />
                {member.display_name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">{t.admin.events}</h2>
        {(events ?? []).length === 0 ? (
          <p className="muted text-sm">{t.admin.noEvents}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {(events ?? []).map((e) => (
              <li key={e.id} className="py-2">
                <Link href={`/rooms/${id}/events/${e.id}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <p className="muted text-sm">
                  {e.final_start && e.final_end
                    ? `✅ ${formatRange(e.final_start, e.final_end, locale)}`
                    : t.events.searching(formatRangeCompact(e.start_date, e.end_date, locale))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        {others.length > 0 && (
          <ActionForm action={adminTransferRoom} className="space-y-2">
            <input type="hidden" name="roomId" value={room.id} />
            <label className="label" htmlFor="owner">
              {t.admin.changeOwner}
            </label>
            <div className="flex flex-wrap gap-2">
              <select id="owner" name="userId" className="input sm:max-w-xs" required defaultValue="">
                <option value="" disabled>
                  –
                </option>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
            </div>
          </ActionForm>
        )}
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Link href={`/rooms/${id}`} className="btn-secondary">
            {t.admin.openRoom}
          </Link>
          <ActionForm action={deleteRoom}>
            <input type="hidden" name="roomId" value={room.id} />
            <input type="hidden" name="redirectTo" value="/admin?tab=sales" />
            <SubmitButton className="btn-danger" confirm={t.admin.confirmDeleteRoom(room.name)}>
              {t.people.deleteRoom}
            </SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
