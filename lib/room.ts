import { cache } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "./auth";
import { createClient } from "./supabase/server";
import type { JoinRequest, Member, Room } from "./types";

type RoomMember = Member & { joined_at: string };

/** Sala + miembros + permisos de la usuaria actual. 404 si no existe o no tiene acceso. */
export const getRoomContext = cache(async (roomId: string) => {
  const me = await requireProfile();
  const supabase = await createClient();

  const [{ data: room }, { data: memberRows }] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, invite_code, owner_id, require_approval, emoji, image_path, created_at")
      .eq("id", roomId)
      .maybeSingle<Room>(),
    supabase
      .from("room_members")
      .select("joined_at, profiles(id, display_name, avatar_url, color, gender)")
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
  const canManageRoom = isOwner || me.is_admin;

  // Solicitudes pendientes: solo las ve quien puede aceptarlas
  let requests: JoinRequest[] = [];
  if (canManageRoom) {
    const { data } = await supabase
      .from("join_requests")
      .select("created_at, profiles(id, display_name, avatar_url, color, gender)")
      .eq("room_id", roomId)
      .order("created_at")
      .returns<{ created_at: string; profiles: Member | null }[]>();
    requests = (data ?? []).flatMap((r) => (r.profiles ? [{ member: r.profiles, created_at: r.created_at }] : []));
  }

  return { me, room, members, requests, isOwner, isMember, canManageRoom };
});
