"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setFinalDate } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/components/I18nProvider";
import {
  bestWindows,
  dayLevel,
  dayScore,
  nextStatus,
  selectableDays,
  summarize,
  type DaySummary,
} from "@/lib/availability";
import {
  addDays,
  daysBetween,
  daysInMonth,
  formatDayLong,
  formatMonth,
  formatRange,
  monthsInRange,
  toUTC,
  weekdayMon0,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { AvailabilityRow, AvailabilityStatus, Member, RoomEvent } from "@/lib/types";

type Drag = { from: string; to: string; target: AvailabilityStatus | null };

export function EventCalendar({
  roomId,
  event,
  members,
  initialRows,
  meId,
  canMark,
  canManage,
  today,
}: {
  roomId: string;
  event: RoomEvent;
  members: Member[];
  initialRows: AvailabilityRow[];
  meId: string;
  canMark: boolean;
  canManage: boolean;
  today: string;
}) {
  const { t, locale } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(0);
  const inflight = useRef(0);
  const [pendingFinal, startFinal] = useTransition();

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const visibleRows = useMemo(() => rows.filter((r) => memberIds.has(r.user_id)), [rows, memberIds]);
  const allDays = useMemo(() => daysBetween(event.start_date, event.end_date), [event.start_date, event.end_date]);
  const selectable = useMemo(
    () => selectableDays(event.start_date, event.end_date, today),
    [event.start_date, event.end_date, today],
  );
  const selectableSet = useMemo(() => new Set(canMark ? selectable : []), [selectable, canMark]);
  const summaries = useMemo(() => summarize(visibleRows, allDays), [visibleRows, allDays]);
  const mine = useMemo(
    () => new Map(rows.filter((r) => r.user_id === meId).map((r) => [r.day, r.status])),
    [rows, meId],
  );
  const windows = useMemo(
    () => bestWindows(summaries, selectable, members.length),
    [summaries, selectable, members.length],
  );
  const responded = useMemo(() => new Set(visibleRows.map((r) => r.user_id)), [visibleRows]);
  // Todos los meses del evento, recortados a las semanas que tocan el rango y sin semanas ya pasadas
  const months = useMemo(() => {
    const mondayOf = (d: string) => addDays(d, -weekdayMon0(d));
    const from = selectable.length > 0 ? mondayOf(selectable[0]) : mondayOf(event.start_date);
    const to = addDays(mondayOf(event.end_date), 6);
    return monthsInRange(from, to)
      .map((month) => ({ month, days: daysInMonth(month).filter((d) => d >= from && d <= to) }))
      .filter((m) => m.days.length > 0);
  }, [event.start_date, event.end_date, selectable]);

  // ── Datos en vivo: si otra persona marca algo, recargamos la disponibilidad del evento
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (inflight.current > 0) return refetch();
        const { data } = await supabase
          .from("availability")
          .select("user_id, day, status")
          .eq("event_id", event.id)
          .returns<AvailabilityRow[]>();
        if (data && inflight.current === 0) setRows(data);
      }, 400);
    };
    type Row = { user_id?: string; event_id?: string };
    const channel = supabase
      .channel(`event:${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability", filter: `event_id=eq.${event.id}` },
        (p) => {
          const row = (Object.keys(p.new ?? {}).length ? p.new : p.old) as Row;
          if (row.user_id !== meId) refetch();
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "availability" }, (p) => {
        const old = p.old as Row;
        if (old.event_id === event.id && old.user_id !== meId) refetch();
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, event.id, meId]);

  // ── Guardar mi disponibilidad (optimista)
  const apply = async (days: string[], target: AvailabilityStatus | null) => {
    if (days.length === 0) return;
    const daySet = new Set(days);
    setRows((prev) => [
      ...prev.filter((r) => !(r.user_id === meId && daySet.has(r.day))),
      ...(target ? days.map((day) => ({ user_id: meId, day, status: target })) : []),
    ]);
    setError("");
    inflight.current++;
    setSaving((n) => n + 1);
    const { error } = target
      ? await supabase.from("availability").upsert(
          days.map((day) => ({ event_id: event.id, user_id: meId, day, status: target })),
          { onConflict: "event_id,user_id,day" },
        )
      : await supabase.from("availability").delete().eq("event_id", event.id).eq("user_id", meId).in("day", days);
    inflight.current--;
    setSaving((n) => n - 1);
    if (error) {
      setError(t.calendar.saveError);
      const { data } = await supabase
        .from("availability")
        .select("user_id, day, status")
        .eq("event_id", event.id)
        .returns<AvailabilityRow[]>();
      if (data) setRows(data);
    }
  };

  // ── Interacción: tocar rota el estado, arrastrar pinta un rango
  const dayFromPoint = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest("[data-day]") as HTMLElement | null)?.dataset.day;

  const updateDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const day = (e.target as HTMLElement).closest<HTMLElement>("[data-day]")?.dataset.day;
    if (!day) return;
    setFocusDay(day);
    if (!selectableSet.has(day) || e.button !== 0) return;
    if (e.pointerType === "mouse") e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateDrag({ from: day, to: day, target: nextStatus(mine.get(day)) });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const day = dayFromPoint(e.clientX, e.clientY);
    const d = dragRef.current;
    if (d) {
      if (day && day !== d.to) updateDrag({ ...d, to: day });
    } else if (e.pointerType === "mouse" && day) {
      setFocusDay(day);
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    updateDrag(null);
    apply(
      daysBetween(d.from, d.to).filter((x) => selectableSet.has(x)),
      d.target,
    );
  };

  const onKeyDown = (e: React.KeyboardEvent, day: string) => {
    if ((e.key === "Enter" || e.key === " ") && selectableSet.has(day)) {
      e.preventDefault();
      setFocusDay(day);
      apply([day], nextStatus(mine.get(day)));
    }
  };

  const dragDays = useMemo(() => (drag ? new Set(daysBetween(drag.from, drag.to)) : null), [drag]);

  const fixDate = (start: string | null, end: string | null) =>
    startFinal(async () => {
      const res = await setFinalDate(roomId, event.id, start, end);
      if (res?.error) setError(res.error);
    });

  const isFinal = (d: string) => !!event.final_start && d >= event.final_start && d <= event.final_end!;
  const me = members.find((m) => m.id === meId);
  const pending = members.filter((m) => !responded.has(m.id));

  return (
    <div className="space-y-4">
      {event.final_start && event.final_end && (
        <FinalBanner
          start={event.final_start}
          end={event.final_end}
          members={members}
          summaries={summaries}
          canManage={canManage}
          busy={pendingFinal}
          onClear={() => fixDate(null, null)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
        <div className="card space-y-3 px-2 sm:px-4">
          <div
            className="touch-pan-y space-y-6 select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => updateDrag(null)}
            onPointerLeave={(e) => e.pointerType === "mouse" && !dragRef.current && setFocusDay(null)}
          >
            {months.map(({ month, days }) => (
              <div key={month} className="space-y-2">
                <h2 className="text-center font-semibold">{formatMonth(month, locale)}</h2>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
                  {t.calendar.weekdays.map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: weekdayMon0(days[0]) }, (_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {days.map((day) => (
                    <DayCell
                      key={day}
                      day={day}
                      inRange={day >= event.start_date && day <= event.end_date}
                      past={day < today}
                      markable={selectableSet.has(day)}
                      summary={summaries.get(day)}
                      members={members}
                      myStatus={mine.get(day)}
                      myColor={me?.color ?? "#7c3aed"}
                      preview={dragDays?.has(day) && selectableSet.has(day) ? (drag!.target ?? "clear") : undefined}
                      isFinal={isFinal(day)}
                      isToday={day === today}
                      focused={focusDay === day}
                      onKeyDown={(e) => onKeyDown(e, day)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Legend canMark={canMark} saving={saving > 0} />
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        <div className="space-y-4 md:sticky md:top-20">
          {focusDay && summaries.has(focusDay) && (
            <DayDetail
              day={focusDay}
              summary={summaries.get(focusDay)!}
              members={members}
              canManage={canManage}
              busy={pendingFinal}
              onFix={() => fixDate(focusDay, focusDay)}
            />
          )}

          <section className="card">
            <h2 className="font-semibold">{t.calendar.bestDates}</h2>
            {windows.length === 0 ? (
              <p className="muted mt-2 text-sm">{t.calendar.bestEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {windows.map((w) => (
                  <li key={w.start} className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <div className="min-w-0 flex-1">
                      <button
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => {
                          setFocusDay(w.start);
                          document
                            .querySelector(`[data-day="${w.start}"]`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      >
                        {formatRange(w.start, w.end, locale)}
                      </button>
                      <p className="muted text-xs">
                        {t.calendar.days(w.days)} ·{" "}
                        {w.minAvailable === members.length ? (
                          w.allYesDays === w.days ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {t.calendar.allCan}
                            </span>
                          ) : (
                            t.calendar.allCanMaybe
                          )
                        ) : (
                          t.calendar.someCan(w.minAvailable, members.length)
                        )}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        className="btn-secondary px-3 py-1 text-xs"
                        disabled={pendingFinal}
                        onClick={() => fixDate(w.start, w.end)}
                      >
                        {t.calendar.fix}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="font-semibold">{t.calendar.whoMarked}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-2 rounded-full border px-2 py-1 text-sm ${
                    responded.has(m.id)
                      ? "border-zinc-200 dark:border-zinc-700"
                      : "border-dashed border-zinc-300 opacity-50 dark:border-zinc-700"
                  }`}
                >
                  <Avatar member={m} size="sm" />
                  {m.display_name}
                </li>
              ))}
            </ul>
            {pending.length > 0 && (
              <p className="muted mt-3 text-xs">{t.calendar.missing(pending.map((m) => m.display_name).join(", "))}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DayCell({
  day,
  inRange,
  past,
  markable,
  summary,
  members,
  myStatus,
  myColor,
  preview,
  isFinal,
  isToday,
  focused,
  onKeyDown,
}: {
  day: string;
  inRange: boolean;
  past: boolean;
  markable: boolean;
  summary: DaySummary | undefined;
  members: Member[];
  myStatus: AvailabilityStatus | undefined;
  myColor: string;
  preview: AvailabilityStatus | "clear" | undefined;
  isFinal: boolean;
  isToday: boolean;
  focused: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const { t, locale } = useI18n();
  const n = toUTC(day).getUTCDate();

  if (!inRange) {
    return (
      <div className="flex aspect-square items-start justify-start p-1 text-xs text-zinc-300 dark:text-zinc-700">
        {n}
      </div>
    );
  }

  const level = dayLevel(summary, members.length);
  const score = dayScore(summary, members.length);
  const total = (summary?.yes.length ?? 0) + (summary?.maybe.length ?? 0);
  const status = preview === undefined ? myStatus : preview === "clear" ? undefined : preview;

  const bg =
    level === "all-yes"
      ? "bg-emerald-500 text-white"
      : level === "all-maybe"
        ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-800/70 dark:text-emerald-50"
        : "bg-zinc-50 dark:bg-zinc-800/40";
  const style: React.CSSProperties =
    level === "partial"
      ? { backgroundColor: `color-mix(in oklab, var(--color-violet-500) ${Math.round(10 + score * 50)}%, transparent)` }
      : {};
  if (status === "yes") style.boxShadow = `inset 0 0 0 3px ${myColor}`;
  if (status === "maybe") {
    style.outline = `2px dashed ${myColor}`;
    style.outlineOffset = "-4px";
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const dots = [
    ...(summary?.yes ?? []).map((id) => ({ m: byId.get(id), maybe: false })),
    ...(summary?.maybe ?? []).map((id) => ({ m: byId.get(id), maybe: true })),
  ].filter((d) => d.m);

  const label = `${formatDayLong(day, locale)}: ${
    myStatus === "yes" ? t.calendar.youCan : myStatus === "maybe" ? t.calendar.youMaybe : t.calendar.youNone
  }, ${t.calendar.someCan(total, members.length)}`;

  return (
    <button
      type="button"
      data-day={day}
      aria-label={label}
      title={label}
      disabled={!markable && past}
      onKeyDown={onKeyDown}
      style={style}
      className={`relative flex aspect-square flex-col items-stretch justify-between rounded-lg p-1 text-left text-xs transition ${bg} ${
        past
          ? "opacity-35"
          : markable
            ? "cursor-pointer hover:brightness-95 dark:hover:brightness-125"
            : "cursor-default"
      } ${preview ? "scale-95" : ""} ${focused ? "ring-2 ring-zinc-900/40 dark:ring-white/50" : ""} ${
        isFinal ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900" : ""
      }`}
    >
      <span className="flex items-center justify-between">
        <span
          className={`font-semibold ${isToday ? "rounded bg-zinc-900 px-1 text-white dark:bg-white dark:text-zinc-900" : ""}`}
        >
          {n}
        </span>
        {isFinal ? (
          <span aria-hidden>⭐</span>
        ) : (
          status && (
            <span aria-hidden className="font-bold">
              {status === "yes" ? "✓" : "?"}
            </span>
          )
        )}
      </span>
      {dots.length > 0 && (
        <span className="flex flex-wrap gap-0.5">
          {dots.slice(0, 6).map(({ m, maybe }) => (
            <span
              key={m!.id}
              className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
              style={maybe ? { boxShadow: `inset 0 0 0 1.5px ${m!.color}` } : { backgroundColor: m!.color }}
            />
          ))}
          {dots.length > 6 && <span className="text-[9px] leading-none">+{dots.length - 6}</span>}
        </span>
      )}
    </button>
  );
}

function Legend({ canMark, saving }: { canMark: boolean; saving: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
      {canMark && (
        <p className="muted">
          <strong className="text-zinc-700 dark:text-zinc-200">{t.calendar.tapDay}</strong>
          {t.calendar.tapDayRest} <strong className="text-zinc-700 dark:text-zinc-200">{t.calendar.drag}</strong>
          {t.calendar.dragRest}
          {saving && <span className="ml-2 text-violet-600">{t.common.saving}</span>}
        </p>
      )}
      <div className="muted flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-500" /> {t.calendar.legendAll}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800" /> {t.calendar.legendAllMaybe}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-violet-400/60" /> {t.calendar.legendSome}
        </span>
        <span className="flex items-center gap-1">⭐ {t.calendar.legendFinal}</span>
      </div>
    </div>
  );
}

function DayDetail({
  day,
  summary,
  members,
  canManage,
  busy,
  onFix,
}: {
  day: string;
  summary: DaySummary;
  members: Member[];
  canManage: boolean;
  busy: boolean;
  onFix: () => void;
}) {
  const { t, locale } = useI18n();
  const byId = new Map(members.map((m) => [m.id, m]));
  const yes = summary.yes.flatMap((id) => byId.get(id) ?? []);
  const maybe = summary.maybe.flatMap((id) => byId.get(id) ?? []);
  const none = members.filter((m) => !summary.yes.includes(m.id) && !summary.maybe.includes(m.id));

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold first-letter:uppercase">{formatDayLong(day, locale)}</h2>
        {canManage && (
          <button className="btn-secondary px-3 py-1 text-xs" disabled={busy} onClick={onFix}>
            {t.calendar.fixDay}
          </button>
        )}
      </div>
      <PeopleGroup title={t.calendar.canGo} list={yes} />
      <PeopleGroup title={t.calendar.maybe} list={maybe} />
      <PeopleGroup title={t.calendar.notMarked} list={none} />
    </section>
  );
}

function FinalBanner({
  start,
  end,
  members,
  summaries,
  canManage,
  busy,
  onClear,
}: {
  start: string;
  end: string;
  members: Member[];
  summaries: Map<string, DaySummary>;
  canManage: boolean;
  busy: boolean;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const days = daysBetween(start, end);
  const coming = members.filter((m) =>
    days.every((d) => {
      const s = summaries.get(d);
      return !!s && (s.yes.includes(m.id) || s.maybe.includes(m.id));
    }),
  );
  return (
    <div className="card border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl">🎉</span>
        <div className="mr-auto">
          <p className="text-xs font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400">
            {t.calendar.finalLabel}
          </p>
          <p className="text-lg font-semibold first-letter:uppercase">{formatRange(start, end, locale)}</p>
          {coming.length > 0 && (
            <p className="muted text-xs">{t.calendar.hadMarked(coming.map((m) => m.display_name).join(", "))}</p>
          )}
        </div>
        {canManage && (
          <button className="btn-ghost text-xs" disabled={busy} onClick={onClear}>
            {t.calendar.clearFinal}
          </button>
        )}
      </div>
    </div>
  );
}

function PeopleGroup({ title, list }: { title: string; list: Member[] }) {
  if (list.length === 0) return null;
  return (
    <div>
      <p className="muted mb-1 text-xs">{title}</p>
      <div className="flex flex-wrap gap-1">
        {list.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-2 pl-0.5 text-xs dark:bg-zinc-800"
          >
            <Avatar member={m} size="sm" />
            {m.display_name}
          </span>
        ))}
      </div>
    </div>
  );
}
