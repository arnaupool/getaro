import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent, updateEvent } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatRange, todayISO } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { getRoomContext } from "@/lib/room";
import { getPublicUrl } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRow, Poll, RoomEvent } from "@/lib/types";
import { EventCalendar } from "./EventCalendar";
import { EventPolls, PollsLive } from "./EventPolls";

const TABS = ["calendario", "encuestas"] as const;
type Tab = (typeof TABS)[number];

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id, eventId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.find((x) => x === rawTab) ?? "calendario";
  const ctx = await getRoomContext(id);
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const [{ data: event }, { data: rows }, { data: polls }, publicUrl] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).eq("room_id", id).maybeSingle<RoomEvent>(),
    supabase
      .from("availability")
      .select("id, user_id, day, status")
      .eq("event_id", eventId)
      .returns<AvailabilityRow[]>(),
    supabase
      .from("polls")
      .select(
        "id, question, multiple, closed, created_by, created_at, poll_options(id, label, position), poll_votes(id, option_id, user_id)",
      )
      .eq("event_id", eventId)
      .order("created_at")
      .returns<Poll[]>(),
    getPublicUrl(),
  ]);
  if (!event) notFound();

  const creator = ctx.members.find((m) => m.id === event.created_by);
  const canManage = event.created_by === ctx.me.id || ctx.canManageRoom;
  // Encuestas abiertas en las que todavía no he votado: el número de la pestaña
  const pendingPolls = ctx.isMember
    ? (polls ?? []).filter((p) => !p.closed && !p.poll_votes.some((v) => v.user_id === ctx.me.id)).length
    : 0;
  const tabLabels: Record<Tab, string> = { calendario: t.event.tabCalendar, encuestas: t.polls.title };

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

      <nav className="flex gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/rooms/${id}/events/${eventId}?tab=${x}`}
            replace
            scroll={false}
            className={`flex-1 rounded-xl px-2 py-2 text-center text-sm font-medium whitespace-nowrap transition sm:px-3 ${
              tab === x
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {tabLabels[x]}
            {x === "encuestas" && pendingPolls > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-xs text-white">
                {pendingPolls}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <PollsLive eventId={event.id} meId={ctx.me.id} polls={polls ?? []} />

      {tab === "calendario" && (
        <EventCalendar
          roomId={id}
          roomName={ctx.room.name}
          publicUrl={publicUrl}
          event={event}
          members={ctx.members}
          initialRows={rows ?? []}
          meId={ctx.me.id}
          canMark={ctx.isMember}
          canManage={canManage}
          today={todayISO()}
        />
      )}

      {tab === "encuestas" && (
        <EventPolls
          roomId={id}
          eventId={event.id}
          polls={polls ?? []}
          members={ctx.members}
          meId={ctx.me.id}
          canParticipate={ctx.isMember}
          canModerate={ctx.canManageRoom}
        />
      )}

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
