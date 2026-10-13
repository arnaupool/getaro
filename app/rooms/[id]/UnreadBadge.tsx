"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Contador de mensajes sin leer en la pestaña Xat; sube en vivo mientras estás en otra pestaña de la sala */
export function UnreadBadge({
  roomId,
  meId,
  initial,
  active,
}: {
  roomId: string;
  meId: string;
  initial: number;
  active: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (active) return;
    const channel = supabase
      .channel(`room-unread:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if ((payload.new as { user_id: string | null }).user_id !== meId) setCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, meId, active]);

  if (active || count === 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
