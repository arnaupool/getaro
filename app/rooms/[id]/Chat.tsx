"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/components/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import type { Member, Message } from "@/lib/types";

// Mensajes que carga la página (ver ChatTab) y los que se piden cada vez al subir
const PAGE_INITIAL = 100;
const PAGE_OLDER = 50;

export function Chat({
  roomId,
  initialMessages,
  members,
  meId,
  canModerate,
  canWrite,
}: {
  roomId: string;
  initialMessages: Message[];
  members: Member[];
  meId: string;
  canModerate: boolean;
  canWrite: boolean;
}) {
  const { t, locale } = useI18n();
  const [timeFmt, dayFmt] = useMemo(
    () => [
      new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" }),
      new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long" }),
    ],
    [locale],
  );
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_INITIAL);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Altura antes de añadir mensajes antiguos arriba, para no mover lo que se estaba leyendo
  const prependFrom = useRef<number | null>(null);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const router = useRouter();
  const refreshedFor = useRef(new Set<string>());

  // Mensaje de alguien que ha entrado después de abrir la página: recargamos la lista de miembros
  useEffect(() => {
    const unknown = messages.find((m) => m.user_id && !byId.has(m.user_id) && !refreshedFor.current.has(m.user_id));
    if (unknown?.user_id) {
      refreshedFor.current.add(unknown.user_id);
      router.refresh();
    }
  }, [messages, byId, router]);

  const addMessage = (m: Message) => setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));

  useEffect(() => {
    const channel = supabase
      .channel(`room-chat:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => addMessage(payload.new as Message),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const id = (payload.old as { id?: number }).id;
        if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId]);

  // Bajar al final solo cuando llega un mensaje nuevo (no al cargar antiguos)
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && prependFrom.current !== null) {
      el.scrollTop += el.scrollHeight - prependFrom.current;
      prependFrom.current = null;
    }
  }, [messages]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    const { data } = await supabase
      .from("messages")
      .select("id, room_id, user_id, body, created_at")
      .eq("room_id", roomId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_OLDER)
      .returns<Message[]>();
    setLoadingOlder(false);
    if (!data) return;
    setHasMore(data.length === PAGE_OLDER);
    prependFrom.current = listRef.current?.scrollHeight ?? null;
    setMessages((prev) => [...data.reverse().filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
  };

  // Con el chat abierto, todo lo que hay en pantalla cuenta como leído
  useEffect(() => {
    if (!canWrite) return;
    // Las consultas de Supabase no se envían hasta que alguien espera el resultado: hace falta el .then()
    supabase.rpc("mark_room_read", { rid: roomId }).then(({ error }) => {
      if (error) console.error("mark_room_read", error.message);
    });
  }, [supabase, roomId, canWrite, messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ room_id: roomId, user_id: meId, body: text })
      .select("id, room_id, user_id, body, created_at")
      .single();
    setSending(false);
    if (error) {
      setError(error.message.includes("rate_limited") ? t.errors.rateLimited : t.chat.sendError);
      return;
    }
    setBody("");
    addMessage(data as Message);
  };

  const remove = async (id: number) => {
    if (!window.confirm(t.chat.confirmDelete)) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="card flex h-[calc(100dvh-15rem)] min-h-80 flex-col p-0">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-4">
        {hasMore && (
          <div className="pb-2 text-center">
            <button type="button" className="btn-ghost text-xs" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? t.chat.loading : t.chat.loadOlder}
            </button>
          </div>
        )}
        {messages.length === 0 && <p className="muted mt-10 text-center text-sm">{t.chat.empty}</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.user_id === meId;
          const author = m.user_id ? byId.get(m.user_id) : undefined;
          const date = new Date(m.created_at);
          const newDay = !prev || new Date(prev.created_at).toDateString() !== date.toDateString();
          const grouped = !newDay && prev?.user_id === m.user_id;
          return (
            <div key={m.id}>
              {newDay && <p className="muted py-2 text-center text-xs first-letter:uppercase">{dayFmt.format(date)}</p>}
              <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "" : "mt-2"}`}>
                <div className="w-6">
                  {!mine &&
                    !grouped &&
                    (author ? <Avatar member={author} size="sm" /> : <span className="text-xs">👻</span>)}
                </div>
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  {!mine && !grouped && (
                    <p className="mb-0.5 text-xs font-medium" style={{ color: author?.color }}>
                      {author?.display_name ?? t.chat.someoneLeft}
                    </p>
                  )}
                  <div
                    className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm ${
                      mine ? "bg-violet-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    {m.body}
                    <span className={`ml-2 text-[10px] ${mine ? "text-violet-200" : "text-zinc-400"}`}>
                      {timeFmt.format(date)}
                    </span>
                  </div>
                </div>
                {(mine || canModerate) && (
                  <button
                    onClick={() => remove(m.id)}
                    className="p-1 text-xs text-zinc-400 opacity-50 hover:text-rose-500 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    title={t.common.delete}
                    aria-label={t.common.delete}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {canWrite ? (
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder={t.chat.placeholder}
            className="input"
            aria-label={t.chat.message}
          />
          <button type="submit" className="btn-primary" disabled={sending || !body.trim()}>
            {t.chat.send}
          </button>
        </form>
      ) : (
        <p className="muted border-t border-zinc-200 p-3 text-center text-xs dark:border-zinc-800">
          {t.chat.adminView}
        </p>
      )}
      {error && <p className="px-3 pb-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
