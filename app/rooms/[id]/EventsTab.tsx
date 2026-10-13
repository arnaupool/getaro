import Link from "next/link";
import { createEvent } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { addDays, formatRange, formatRangeCompact, todayISO } from "@/lib/dates";
import type { Dict, Locale } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import type { getRoomContext } from "@/lib/room";
import { createClient } from "@/lib/supabase/server";
import type { RoomEvent } from "@/lib/types";

type Ctx = Awaited<ReturnType<typeof getRoomContext>>;
type EventWithResponses = RoomEvent & { availability: { user_id: string }[] };

export async function EventsTab({ ctx }: { ctx: Ctx }) {
  const { room, members } = ctx;
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*, availability(user_id)")
    .eq("room_id", room.id)
    .order("start_date")
    .returns<EventWithResponses[]>();

  const today = todayISO();
  const events = data ?? [];
  const isPast = (e: RoomEvent) => (e.final_end ?? e.end_date) < today;
  const upcoming = events.filter((e) => !isPast(e));
  const past = events.filter(isPast).reverse();

  return (
    <div className="space-y-6">
      {ctx.isMember && (
        <details className="card group" open={events.length === 0}>
          <summary className="cursor-pointer list-none font-semibold">
            <span className="text-violet-600">＋</span> {t.events.newEvent}
          </summary>
          <ActionForm action={createEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="roomId" value={room.id} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">
                {t.events.what}
              </label>
              <input
                id="title"
                name="title"
                required
                maxLength={80}
                placeholder={t.events.titlePlaceholder}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="start_date">
                {t.events.searchFrom}
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                min={today}
                defaultValue={today}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="end_date">
                {t.events.searchTo}
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                min={today}
                defaultValue={addDays(today, 30)}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">
                {t.events.detailsOptional}
              </label>
              <textarea id="description" name="description" rows={2} maxLength={1000} className="input" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-primary w-full sm:w-auto" pendingText={t.dashboard.creating}>
                {t.events.createAndMark}
              </SubmitButton>
            </div>
          </ActionForm>
        </details>
      )}

      {events.length === 0 ? (
        <p className="muted text-center text-sm">{t.events.empty}</p>
      ) : (
        <>
          <EventList roomId={room.id} events={upcoming} memberCount={members.length} t={t} locale={locale} />
          {past.length > 0 && (
            <div>
              <h2 className="muted mb-2 text-sm font-medium">{t.events.past}</h2>
              <EventList roomId={room.id} events={past} memberCount={members.length} dimmed t={t} locale={locale} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventList({
  roomId,
  events,
  memberCount,
  dimmed,
  t,
  locale,
}: {
  t: Dict;
  locale: Locale;
  roomId: string;
  events: EventWithResponses[];
  memberCount: number;
  dimmed?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <ul className={`grid gap-3 ${dimmed ? "opacity-60" : ""}`}>
      {events.map((e) => {
        const responded = new Set(e.availability.map((a) => a.user_id)).size;
        const confirmed = e.final_start && e.final_end;
        return (
          <li key={e.id}>
            <Link
              href={`/rooms/${roomId}/events/${e.id}`}
              className="card flex items-center gap-3 transition sm:gap-4 hover:border-violet-400 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{e.title}</h3>
                {confirmed ? (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    ✅ {formatRange(e.final_start!, e.final_end!, locale)}
                  </p>
                ) : (
                  <p className="muted text-sm">
                    {t.events.searching(formatRangeCompact(e.start_date, e.end_date, locale))}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {responded}/{memberCount}
                </p>
                <p className="muted text-xs whitespace-nowrap">{t.events.haveMarked}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
