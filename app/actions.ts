"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { diffDays, todayISO } from "@/lib/dates";
import { isLocale, LOCALE_COOKIE, type Dict, type Locale } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/safe-next";
import { ROOM_IMAGES_BUCKET } from "@/lib/room-image";
import { createClient } from "@/lib/supabase/server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Error de los límites contra abuso (trigger enforce_rate_limits, migración 0010) */
function isRateLimited(error: { message?: string }) {
  return error.message?.includes("rate_limited") ?? false;
}

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ─── Salas ──────────────────────────────────────────────────

export async function createRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const me = await requireProfile();
  const name = str(fd, "name");
  if (name.length < 1 || name.length > 50) return { error: t.errors.roomNameLength };

  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").insert({ name, owner_id: me.id }).select("id").single();
  if (error) return { error: isRateLimited(error) ? t.errors.rateLimited : t.errors.createRoom };
  redirect(`/rooms/${data.id}`);
}

export async function joinRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireProfile();
  const code = str(fd, "code")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (code.length !== 8) return { error: t.errors.codeLength };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { code });
  const result = (data as { room_id: string; status: "member" | "joined" | "pending" }[] | null)?.[0];
  if (error || !result) return { error: t.errors.invalidCode };
  revalidatePath("/");
  // Si la sala pide aprobación, la página del enlace muestra "esperando"
  redirect(result.status === "pending" ? `/join/${code}` : `/rooms/${result.room_id}`);
}

export async function cancelJoinRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const me = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("join_requests").delete().eq("room_id", str(fd, "roomId")).eq("user_id", me.id);
  if (error) return { error: t.errors.request };
  revalidatePath("/");
  redirect("/");
}

export async function acceptJoinRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_join_request", { rid: roomId, uid: str(fd, "userId") });
  if (error) return { error: t.errors.request };
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/");
}

export async function rejectJoinRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("join_requests")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", str(fd, "userId"))
    .select("user_id");
  if (error || !data?.length) return { error: t.errors.request };
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/");
}

export async function setRoomEmoji(roomId: string, emoji: string): Promise<ActionState> {
  const { t } = await getI18n();
  const value = emoji.trim().slice(0, 16) || null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").update({ emoji: value }).eq("id", roomId).select("id");
  if (error || !data?.length) return { error: t.errors.save };
  revalidatePath("/", "layout");
}

/** Tras subir la foto desde el navegador: la guarda en la sala y borra la anterior */
export async function setRoomImage(roomId: string, path: string): Promise<ActionState> {
  const { t } = await getI18n();
  if (!path.startsWith(`${roomId}/`)) return { error: t.people.imageError };
  const supabase = await createClient();
  const { data: before } = await supabase.from("rooms").select("image_path").eq("id", roomId).maybeSingle();
  const { data, error } = await supabase.from("rooms").update({ image_path: path }).eq("id", roomId).select("id");
  if (error || !data?.length) return { error: t.people.imageError };
  if (before?.image_path && before.image_path !== path) {
    await supabase.storage.from(ROOM_IMAGES_BUCKET).remove([before.image_path]);
  }
  revalidatePath("/", "layout");
}

export async function clearRoomImage(roomId: string): Promise<ActionState> {
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: before } = await supabase.from("rooms").select("image_path").eq("id", roomId).maybeSingle();
  const { data, error } = await supabase.from("rooms").update({ image_path: null }).eq("id", roomId).select("id");
  if (error || !data?.length) return { error: t.errors.save };
  if (before?.image_path) await supabase.storage.from(ROOM_IMAGES_BUCKET).remove([before.image_path]);
  revalidatePath("/", "layout");
}

export async function setRequireApproval(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .update({ require_approval: fd.get("require_approval") === "on" })
    .eq("id", roomId)
    .select("id");
  if (error || !data?.length) return { error: t.errors.save };
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/");
  return { ok: t.common.saved };
}

export async function renameRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const name = str(fd, "name");
  if (name.length < 1 || name.length > 50) return { error: t.errors.roomNameLength };

  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").update({ name }).eq("id", roomId).select("id");
  if (error || !data?.length) return { error: t.errors.rename };
  revalidatePath(`/rooms/${roomId}`);
  return { ok: t.common.saved };
}

export async function regenerateInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite_code", { rid: roomId });
  if (error) return { error: t.errors.regenerate };
  revalidatePath(`/rooms/${roomId}`);
}

export async function deleteRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const redirectTo = safeNextPath(str(fd, "redirectTo"));
  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").delete().eq("id", roomId).select("id");
  if (error || !data?.length) return { error: t.errors.deleteRoom };
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function leaveRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const me = await requireProfile();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", me.id)
    .select("user_id");
  if (error || !data?.length) return { error: t.errors.leave };
  revalidatePath("/");
  redirect("/");
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const userId = str(fd, "userId");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: t.errors.removeMember };
  revalidatePath(`/rooms/${roomId}`);
}

export async function transferRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const userId = str(fd, "userId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_room", { rid: roomId, new_owner: userId });
  if (error) return { error: t.errors.transfer };
  revalidatePath(`/rooms/${roomId}`);
}

// ─── Eventos ────────────────────────────────────────────────

function parseEvent(fd: FormData, t: Dict) {
  const schema = z
    .object({
      title: z.string().min(1, t.errors.eventTitle).max(80, t.errors.max80),
      description: z.string().max(1000, t.errors.max1000),
      start_date: z.string().regex(ISO_DATE, t.errors.invalidStart),
      end_date: z.string().regex(ISO_DATE, t.errors.invalidEnd),
    })
    .refine((e) => e.end_date >= e.start_date, { message: t.errors.endBeforeStart })
    .refine((e) => diffDays(e.start_date, e.end_date) <= 366, { message: t.errors.maxRange })
    .refine((e) => e.end_date >= todayISO(), { message: t.errors.rangePast });
  return schema.safeParse({
    title: str(fd, "title"),
    description: str(fd, "description"),
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
  });
}

export async function createEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const me = await requireProfile();
  const roomId = str(fd, "roomId");
  const parsed = parseEvent(fd, t);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.data, description: parsed.data.description || null, room_id: roomId, created_by: me.id })
    .select("id")
    .single();
  if (error) return { error: isRateLimited(error) ? t.errors.rateLimited : t.errors.createEvent };
  revalidatePath(`/rooms/${roomId}`);
  redirect(`/rooms/${roomId}/events/${data.id}`);
}

export async function updateEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const eventId = str(fd, "eventId");
  const parsed = parseEvent(fd, t);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", eventId)
    .select("id");
  if (error || !data?.length) return { error: t.errors.saveEvent };
  revalidatePath(`/rooms/${roomId}/events/${eventId}`);
  return { ok: t.common.saved };
}

export async function deleteEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const eventId = str(fd, "eventId");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) return { error: t.errors.deleteEvent };
  revalidatePath(`/rooms/${roomId}`);
  redirect(`/rooms/${roomId}`);
}

export async function setFinalDate(
  roomId: string,
  eventId: string,
  start: string | null,
  end: string | null,
): Promise<ActionState> {
  const { t } = await getI18n();
  if ((start === null) !== (end === null)) return { error: t.errors.incompleteDate };
  if (start && end && (!ISO_DATE.test(start) || !ISO_DATE.test(end) || end < start)) {
    return { error: t.errors.invalidRange };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ final_start: start, final_end: end })
    .eq("id", eventId)
    .select("id");
  if (error || !data?.length) return { error: t.errors.fixDate };
  revalidatePath(`/rooms/${roomId}/events/${eventId}`);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: start ? t.errors.fixed : t.errors.cleared };
}

export async function updateEventDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const roomId = str(fd, "roomId");
  const eventId = str(fd, "eventId");
  const time = str(fd, "final_time");
  const location = str(fd, "location").slice(0, 200);
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: t.errors.saveEvent };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ final_time: time || null, location: location || null })
    .eq("id", eventId)
    .select("id");
  if (error || !data?.length) return { error: t.errors.saveEvent };
  revalidatePath(`/rooms/${roomId}/events/${eventId}`);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/");
  return { ok: t.common.saved };
}

// ─── Perfil ─────────────────────────────────────────────────

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const me = await requireProfile();
  const display_name = str(fd, "display_name");
  const color = str(fd, "color");
  const genderValue = str(fd, "gender");
  const gender = genderValue === "f" || genderValue === "m" ? genderValue : "n";
  if (display_name.length < 1 || display_name.length > 40) return { error: t.errors.displayNameLength };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: t.errors.invalidColor };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name, color, gender }).eq("id", me.id);
  if (error) return { error: t.errors.save };
  revalidatePath("/", "layout");
  return { ok: t.common.saved };
}

// ─── Admin ──────────────────────────────────────────────────

export async function adminDeleteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { uid: str(fd, "userId") });
  if (error) return { error: t.errors.deleteUser(error.message) };
  revalidatePath("/admin", "layout");
  if (str(fd, "redirectTo")) redirect(safeNextPath(str(fd, "redirectTo")));
}

export async function adminSetAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_admin", { uid: str(fd, "userId"), value: str(fd, "value") === "true" });
  if (error) return { error: t.errors.setAdmin(error.message) };
  revalidatePath("/admin", "layout");
}

export async function adminRenameUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireAdmin();
  const name = str(fd, "name");
  if (name.length < 1 || name.length > 40) return { error: t.errors.displayNameLength };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_rename_user", { uid: str(fd, "userId"), new_name: name });
  if (error) return { error: t.errors.save };
  revalidatePath("/admin", "layout");
  return { ok: t.common.saved };
}

export async function adminSignOutUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sign_out_user", { uid: str(fd, "userId") });
  if (error) return { error: t.errors.save };
  revalidatePath("/admin", "layout");
  return { ok: t.admin.signedOut(Number(data ?? 0)) };
}

export async function adminTransferRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  await requireAdmin();
  const roomId = str(fd, "roomId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_room", { rid: roomId, new_owner: str(fd, "userId") });
  if (error) return { error: t.errors.transfer };
  revalidatePath("/admin", "layout");
  revalidatePath(`/rooms/${roomId}`);
  return { ok: t.common.saved };
}

// ─── Idioma ─────────────────────────────────────────────────

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
