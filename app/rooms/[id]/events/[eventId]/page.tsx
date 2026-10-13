import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent, updateEvent } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatRange, todayISO } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { getRoomContext } from "@/lib/room";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRow, RoomEvent } from "@/lib/types";
import { EventCalendar } from "./EventCalendar";

export default async function EventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const ctx = await getRoomContext(id);
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const [{ data: event }, { data: rows }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).eq("room_id", id).maybeSingle<RoomEvent>(),
    supabase.from("availability").select("user_id, day, status").eq("event_id", eventId).returns<AvailabilityRow[]>(),
  ]);
  if (!event) notFound();

  const creator = ctx.members.find((m) => m.id === event.created_by);
  const canManage = event.created_by === ctx.me.id || ctx.canManageRoom;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/rooms/${id}`} className="muted text-sm hover:underline">
          ← {ctx.room.name}
        </Link>
        <h1 className="text-2xl font-bold break-words">{event.title}</h1>
        <p className="muted text-sm">
          {t.event.searchingBetween(formatRange(event.start_date, event.end_date, locale))}
          {creator && t.event.proposedBy(creator.display_name)}
        </p>
        {event.description && <p className="mt-2 text-sm break-words whitespace-pre-wrap">{event.description}</p>}
      </div>

      <EventCalendar
        roomId={id}
        event={event}
        members={ctx.members}
        initialRows={rows ?? []}
        meId={ctx.me.id}
        canMark={ctx.isMember}
        canManage={canManage}
        today={todayISO()}
      />

      {canManage && (
        <details className="card">
          <summary className="cursor-pointer list-none font-semibold">{t.event.editOrDelete}</summary>
          <ActionForm action={updateEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="roomId" value={id} />
            <input type="hidden" name="eventId" value={event.id} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">
                {t.event.title}
              </label>
              <input id="title" name="title" required maxLength={80} defaultValue={event.title} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="start_date">
                {t.event.from}
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                defaultValue={event.start_date}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="end_date">
                {t.event.to}
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                defaultValue={event.end_date}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">
                {t.event.details}
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                maxLength={1000}
                defaultValue={event.description ?? ""}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-secondary">{t.event.saveChanges}</SubmitButton>
            </div>
          </ActionForm>
          <ActionForm action={deleteEvent} className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <input type="hidden" name="roomId" value={id} />
            <input type="hidden" name="eventId" value={event.id} />
            <SubmitButton className="btn-danger" confirm={t.event.confirmDelete(event.title)}>
              {t.event.deleteEvent}
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
