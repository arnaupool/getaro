"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { addPollOption, createPoll, deletePoll, setPollClosed, votePoll } from "@/app/actions";
import { AvatarStack } from "@/components/Avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { useI18n } from "@/components/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import type { Member, Poll } from "@/lib/types";

const MAX_OPTIONS = 10;

type Props = {
  roomId: string;
  eventId: string;
  polls: Poll[];
  members: Member[];
  meId: string;
  canParticipate: boolean;
  canModerate: boolean;
};

export function EventPolls({ roomId, eventId, polls, members, meId, canParticipate, canModerate }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const path = `/rooms/${roomId}/events/${eventId}`;
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  // El voto propio se ve al momento; al volver la respuesta del servidor llegan los datos reales
  const [shown, applyVote] = useOptimistic(polls, (state, vote: { pollId: string; optionIds: string[] }) =>
    state.map((p) =>
      p.id !== vote.pollId
        ? p
        : {
            ...p,
            poll_votes: [
              ...p.poll_votes.filter((v) => v.user_id !== meId),
              ...vote.optionIds.map((option_id, i) => ({ id: -1 - i, option_id, user_id: meId })),
            ],
          },
    ),
  );

  const vote = (poll: Poll, optionId: string) => {
    const mine = poll.poll_votes.filter((v) => v.user_id === meId).map((v) => v.option_id);
    const selected = mine.includes(optionId);
    const optionIds = poll.multiple
      ? selected
        ? mine.filter((id) => id !== optionId)
        : [...mine, optionId]
      : selected
        ? []
        : [optionId];
    setError("");
    startTransition(async () => {
      applyVote({ pollId: poll.id, optionIds });
      const res = await votePoll(path, poll.id, optionIds);
      if (res?.error) setError(res.error);
    });
  };

  // ── En directo: si otra persona vota, crea o cierra una encuesta, recargamos
  const known = useRef({ polls: new Set<string>(), votes: new Set<number>() });
  useEffect(() => {
    known.current = {
      polls: new Set(polls.map((p) => p.id)),
      votes: new Set(polls.flatMap((p) => p.poll_votes.map((v) => v.id))),
    };
  }, [polls]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    type Row = { id?: string | number; poll_id?: string; user_id?: string };
    const channel = supabase
      .channel(`polls:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "polls", filter: `event_id=eq.${eventId}` },
        refresh,
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "polls" }, (p) => {
        if (known.current.polls.has(String((p.old as Row).id))) refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "poll_options" }, (p) => {
        if (known.current.polls.has(String((p.new as Row).poll_id))) refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "poll_votes" }, (p) => {
        const row = p.new as Row;
        if (row.user_id !== meId && known.current.polls.has(String(row.poll_id))) refresh();
      })
      // Los DELETE llegan sin RLS y solo con el id del voto
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "poll_votes" }, (p) => {
        if (known.current.votes.has(Number((p.old as Row).id))) refresh();
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [eventId, meId, router]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t.polls.title}</h2>

      {shown.length === 0 && <p className="muted text-sm">{t.polls.empty}</p>}

      {shown.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          members={members}
          meId={meId}
          roomId={roomId}
          eventId={eventId}
          canVote={canParticipate && !poll.closed}
          canManage={canModerate || (canParticipate && poll.created_by === meId)}
          onVote={(optionId) => vote(poll, optionId)}
        />
      ))}

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {canParticipate && <NewPollForm roomId={roomId} eventId={eventId} />}
    </section>
  );
}

function PollCard({
  poll,
  members,
  meId,
  roomId,
  eventId,
  canVote,
  canManage,
  onVote,
}: {
  poll: Poll;
  members: Member[];
  meId: string;
  roomId: string;
  eventId: string;
  canVote: boolean;
  canManage: boolean;
  onVote: (optionId: string) => void;
}) {
  const { t } = useI18n();
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const options = [...poll.poll_options].sort((a, b) => a.position - b.position);
  const voters = new Set(poll.poll_votes.map((v) => v.user_id));
  const maxVotes = Math.max(1, ...options.map((o) => poll.poll_votes.filter((v) => v.option_id === o.id).length));
  const missing = members.filter((m) => !voters.has(m.id));
  const author = poll.created_by ? byId.get(poll.created_by) : undefined;
  const isAuthor = poll.created_by === meId;

  return (
    <article className={`card space-y-3 ${poll.closed ? "opacity-80" : ""}`}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="min-w-0 flex-1 font-semibold break-words">{poll.question}</h3>
          {poll.closed && <span className="badge bg-zinc-200 dark:bg-zinc-800">{t.polls.closed}</span>}
        </div>
        <p className="muted text-xs">
          {author && t.polls.proposedBy(author.display_name)}
          {poll.multiple && <> · {t.polls.multipleHint}</>}
        </p>
      </header>

      <ul className="space-y-2">
        {options.map((option) => {
          const votes = poll.poll_votes.filter((v) => v.option_id === option.id);
          const mine = votes.some((v) => v.user_id === meId);
          const who = votes.flatMap((v) => byId.get(v.user_id) ?? []);
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={!canVote}
                aria-pressed={mine}
                onClick={() => onVote(option.id)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition ${
                  mine ? "border-violet-500 ring-1 ring-violet-500" : "border-zinc-200 dark:border-zinc-700"
                } ${canVote ? "hover:border-violet-400" : "cursor-default"}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r-md bg-violet-100 transition-all dark:bg-violet-900/40"
                  style={{ width: `${(votes.length / maxVotes) * 100}%` }}
                />
                <span className="relative flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 text-xs ${
                      poll.multiple ? "rounded-md" : "rounded-full"
                    } ${mine ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-400"}`}
                  >
                    {mine && "✓"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm break-words">{option.label}</span>
                  {who.length > 0 && <AvatarStack members={who} max={4} />}
                  <span className="muted text-xs tabular-nums">{t.polls.votes(votes.length)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="muted text-xs">
        {t.polls.voted(voters.size, members.length)}
        {missing.length > 0 && !poll.closed && (
          <> · {t.calendar.missing(missing.map((m) => m.display_name).join(", "))}</>
        )}
      </p>

      {isAuthor && !poll.closed && options.length < MAX_OPTIONS && (
        <ActionForm action={addPollOption} className="flex gap-2">
          <input type="hidden" name="roomId" value={roomId} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="pollId" value={poll.id} />
          <input name="label" required maxLength={80} placeholder={t.polls.newOption} className="input" />
          <SubmitButton className="btn-secondary">{t.polls.add}</SubmitButton>
        </ActionForm>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <ActionForm action={setPollClosed}>
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="pollId" value={poll.id} />
            <input type="hidden" name="closed" value={String(!poll.closed)} />
            <SubmitButton className="btn-ghost text-xs">{poll.closed ? t.polls.reopen : t.polls.close}</SubmitButton>
          </ActionForm>
          <ActionForm action={deletePoll}>
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="pollId" value={poll.id} />
            <SubmitButton
              className="btn-ghost text-xs text-rose-600 dark:text-rose-400"
              confirm={t.polls.confirmDelete(poll.question)}
            >
              {t.polls.delete}
            </SubmitButton>
          </ActionForm>
        </div>
      )}
    </article>
  );
}

function NewPollForm({ roomId, eventId }: { roomId: string; eventId: string }) {
  const { t } = useI18n();
  const [count, setCount] = useState(2);

  return (
    <details className="card">
      <summary className="cursor-pointer list-none font-semibold">
        <span className="text-violet-600">＋</span> {t.polls.new}
      </summary>
      <ActionForm action={createPoll} className="mt-4 space-y-3">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="eventId" value={eventId} />
        <div>
          <label className="label" htmlFor="poll-question">
            {t.polls.question}
          </label>
          <input
            id="poll-question"
            name="question"
            required
            maxLength={140}
            placeholder={t.polls.questionPlaceholder}
            className="input"
          />
        </div>
        <div className="space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              name="option"
              required={i < 2}
              maxLength={80}
              placeholder={t.polls.option(i + 1)}
              aria-label={t.polls.option(i + 1)}
              className="input"
            />
          ))}
          {count < MAX_OPTIONS && (
            <button type="button" className="btn-ghost text-sm" onClick={() => setCount((c) => c + 1)}>
              ＋ {t.polls.addOptionField}
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="multiple" className="h-4 w-4 accent-violet-600" />
          {t.polls.multiple}
        </label>
        <SubmitButton pendingText={t.polls.creating}>{t.polls.create}</SubmitButton>
      </ActionForm>
    </details>
  );
}
