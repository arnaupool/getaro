import Link from "next/link";
import { createRoom, joinRoom } from "./actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireProfile } from "@/lib/auth";
import { formatRange, todayISO } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type RoomRow = {
  rooms: {
    id: string;
    name: string;
    owner_id: string | null;
    room_members: { count: number }[];
    events: { count: number }[];
  } | null;
};

export default async function Dashboard() {
  const me = await requireProfile();
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const [{ data }, { data: requestRows }, { data: myRequests }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("room_members")
      .select("rooms(id, name, owner_id, room_members(count), events(count))")
      .eq("user_id", me.id)
      .order("joined_at", { ascending: false })
      .returns<RoomRow[]>(),
    // Solicitudes que puedo aceptar (RLS: salas de las que soy dueña)
    supabase.from("join_requests").select("room_id").returns<{ room_id: string }[]>(),
    supabase.rpc("my_join_requests"),
    supabase.rpc("unread_counts"),
  ]);
  const rooms = (data ?? []).flatMap((r) => (r.rooms ? [r.rooms] : []));
  const pendingByRoom = new Map<string, number>();
  for (const r of requestRows ?? []) pendingByRoom.set(r.room_id, (pendingByRoom.get(r.room_id) ?? 0) + 1);
  const waiting = (myRequests ?? []) as { room_id: string; name: string }[];
  type Upcoming = {
    id: string;
    room_id: string;
    title: string;
    final_start: string;
    final_end: string;
    final_time: string | null;
    location: string | null;
  };
  const roomIds = rooms.map((r) => r.id);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const { data: upcomingData } = roomIds.length
    ? await supabase
        .from("events")
        .select("id, room_id, title, final_start, final_end, final_time, location")
        .in("room_id", roomIds)
        .gte("final_end", todayISO())
        .order("final_start")
        .limit(5)
        .returns<Upcoming[]>()
    : { data: [] as Upcoming[] };
  const upcoming = upcomingData ?? [];
  const unreadByRoom = new Map(
    ((unreadRows ?? []) as { room_id: string; unread: number }[]).map((r) => [r.room_id, r.unread]),
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold break-words">{t.dashboard.hello(me.display_name)}</h1>
        <p className="muted mt-1">{t.dashboard.yourRooms}</p>

        {rooms.length === 0 && waiting.length === 0 ? (
          <div className="card mt-4 text-center">
            <p className="text-3xl">🫶</p>
            <p className="mt-2 font-medium">{t.dashboard.noRooms}</p>
            <p className="muted text-sm">{t.dashboard.noRoomsHint}</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="card block transition hover:border-violet-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-semibold break-words">{room.name}</h2>
                    {room.owner_id === me.id && (
                      <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {t.common.owner(me.gender ?? "n")}
                      </span>
                    )}
                  </div>
                  {(unreadByRoom.get(room.id) ?? 0) > 0 && (
                    <p className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-400">
                      {t.dashboard.unread(unreadByRoom.get(room.id)!)}
                    </p>
                  )}
                  {(pendingByRoom.get(room.id) ?? 0) > 0 && (
                    <p className="mt-1 text-sm font-medium text-violet-600 dark:text-violet-400">
                      {t.dashboard.requestsBadge(pendingByRoom.get(room.id)!)}
                    </p>
                  )}
                  <p className="muted mt-1 text-sm">
                    {t.common.people(room.room_members[0]?.count ?? 0)} · {t.common.events(room.events[0]?.count ?? 0)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {waiting.map((w) => (
              <li key={w.room_id} className="card flex items-center justify-between gap-2 border-dashed py-3">
                <span className="min-w-0 font-medium break-words">{w.name}</span>
                <span className="badge shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {t.dashboard.waiting}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-semibold">{t.dashboard.upcoming}</h2>
          <ul className="mt-3 grid gap-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/rooms/${e.room_id}/events/${e.id}`}
                  className="card flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 transition hover:border-violet-400"
                >
                  <span className="font-semibold text-emerald-600 first-letter:uppercase dark:text-emerald-400">
                    {formatRange(e.final_start, e.final_end, locale)}
                    {e.final_time && ` · ${e.final_time.slice(0, 5)}`}
                  </span>
                  <span className="min-w-0 font-medium break-words">{e.title}</span>
                  <span className="muted min-w-0 text-sm break-words">
                    {[roomName.get(e.room_id), e.location].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <ActionForm action={createRoom} className="card space-y-3">
          <h2 className="font-semibold">{t.dashboard.createRoom}</h2>
          <input name="name" required maxLength={50} placeholder={t.dashboard.roomPlaceholder} className="input" />
          <SubmitButton pendingText={t.dashboard.creating}>{t.dashboard.create}</SubmitButton>
        </ActionForm>

        <ActionForm action={joinRoom} className="card space-y-3">
          <h2 className="font-semibold">{t.dashboard.joinWithCode}</h2>
          <input
            name="code"
            required
            placeholder="ABCD2345"
            className="input font-mono uppercase"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <SubmitButton className="btn-secondary" pendingText={t.dashboard.joining}>
            {t.dashboard.join}
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
