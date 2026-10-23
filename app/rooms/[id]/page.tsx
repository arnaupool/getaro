import Link from "next/link";
import { AvatarStack } from "@/components/Avatar";
import { CopyButton } from "@/components/forms";
import { RoomAvatar } from "@/components/RoomAvatar";
import { getI18n } from "@/lib/i18n/server";
import { shareLink } from "@/lib/public-url";
import { roomImageUrl } from "@/lib/room-image";
import { getRoomContext } from "@/lib/room";
import { getPublicUrl } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";
import { Chat } from "./Chat";
import { EventsTab } from "./EventsTab";
import { PeopleTab } from "./PeopleTab";
import { UnreadBadge } from "./UnreadBadge";

const TABS = [
  { key: "eventos", label: "tabEvents" },
  { key: "chat", label: "tabChat" },
  { key: "gente", label: "tabPeople" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((x) => x.key === rawTab) ? (rawTab as Tab) : "eventos";
  const [ctx, { t }, publicUrl] = await Promise.all([getRoomContext(id), getI18n(), getPublicUrl()]);
  const { room, members, me } = ctx;
  const supabase = await createClient();
  const { data: unreadRows } = await supabase.rpc("unread_counts");
  const unread =
    ((unreadRows ?? []) as { room_id: string; unread: number }[]).find((r) => r.room_id === id)?.unread ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <RoomAvatar name={room.name} emoji={room.emoji} imageUrl={roomImageUrl(room.image_path)} />
        <div className="mr-auto min-w-0">
          <Link href="/" className="muted text-sm hover:underline">
            ← {t.common.myRooms}
          </Link>
          <h1 className="text-2xl font-bold break-words">{room.name}</h1>
        </div>
        <AvatarStack members={members} />
        {ctx.isMember && <CopyButton text={shareLink(publicUrl, `/join/${room.invite_code}`)} label={t.room.invite} />}
      </div>

      <nav className="flex gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={`/rooms/${id}?tab=${x.key}`}
            replace
            className={`flex-1 rounded-xl px-2 py-2 text-center text-sm font-medium whitespace-nowrap transition sm:px-3 ${
              tab === x.key
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.room[x.label]}
            {x.key === "chat" && ctx.isMember && (
              <UnreadBadge key={tab} roomId={id} meId={me.id} initial={unread} active={tab === "chat"} />
            )}
            {x.key === "gente" && ctx.requests.length > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-xs text-white">
                {ctx.requests.length}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "eventos" && <EventsTab ctx={ctx} />}
      {tab === "chat" && (
        <ChatTab roomId={id} members={members} meId={me.id} canModerate={ctx.canManageRoom} canWrite={ctx.isMember} />
      )}
      {tab === "gente" && <PeopleTab ctx={ctx} publicUrl={publicUrl} />}
    </div>
  );
}

async function ChatTab({
  roomId,
  ...rest
}: {
  roomId: string;
  members: React.ComponentProps<typeof Chat>["members"];
  meId: string;
  canModerate: boolean;
  canWrite: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, room_id, user_id, body, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Message[]>();
  return <Chat roomId={roomId} initialMessages={(data ?? []).reverse()} {...rest} />;
}
