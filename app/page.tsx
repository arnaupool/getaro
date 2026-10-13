import Link from "next/link";
import { createRoom, joinRoom } from "./actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireProfile } from "@/lib/auth";
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
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase
    .from("room_members")
    .select("rooms(id, name, owner_id, room_members(count), events(count))")
    .eq("user_id", me.id)
    .order("joined_at", { ascending: false })
    .returns<RoomRow[]>();
  const rooms = (data ?? []).flatMap((r) => (r.rooms ? [r.rooms] : []));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold break-words">{t.dashboard.hello(me.display_name)}</h1>
        <p className="muted mt-1">{t.dashboard.yourRooms}</p>

        {rooms.length === 0 ? (
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
                        {t.common.owner}
                      </span>
                    )}
                  </div>
                  <p className="muted mt-1 text-sm">
                    {t.common.people(room.room_members[0]?.count ?? 0)} · {t.common.events(room.events[0]?.count ?? 0)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
