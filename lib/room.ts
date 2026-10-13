import { cache } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "./auth";
import { createClient } from "./supabase/server";
import type { Member, Room } from "./types";

export type RoomMember = Member & { joined_at: string };

/** Sala + miembros + permisos de la usuaria actual. 404 si no existe o no tiene acceso. */
export const getRoomContext = cache(async (roomId: string) => {
  const me = await requireProfile();
  const supabase = await createClient();

  const [{ data: room }, { data: memberRows }] = await Promise.all([
    supabase.from("rooms").select("id, name, invite_code, owner_id, created_at").eq("id", roomId).maybeSingle<Room>(),
    supabase
      .from("room_members")
      .select("joined_at, profiles(id, display_name, avatar_url, color)")
      .eq("room_id", roomId)
      .order("joined_at")
      .returns<{ joined_at: string; profiles: Member | null }[]>(),
  ]);
  if (!room) notFound();

  const members: RoomMember[] = (memberRows ?? []).flatMap((r) =>
    r.profiles ? [{ ...r.profiles, joined_at: r.joined_at }] : [],
  );
  const isOwner = room.owner_id === me.id;
  const isMember = members.some((m) => m.id === me.id);

  return { me, room, members, isOwner, isMember, canManageRoom: isOwner || me.is_admin };
});
