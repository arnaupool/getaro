import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelJoinRequest, joinRoom } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type Preview = {
  id: string;
  name: string;
  member_count: number;
  already_member: boolean;
  pending: boolean;
  require_approval: boolean;
};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  await requireProfile();
  const { t } = await getI18n();
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("room_preview", { code });
  const room = (data as Preview[] | null)?.[0];

  if (room?.already_member) redirect(`/rooms/${room.id}`);

  if (!room) {
    return (
      <div className="card mx-auto mt-10 max-w-sm space-y-3 text-center">
        <p className="text-4xl">🤷‍♀️</p>
        <h1 className="font-semibold">{t.join.invalid}</h1>
        <p className="muted text-sm">{t.join.invalidHint}</p>
        <Link href="/" className="btn-secondary">
          {t.common.goToRooms}
        </Link>
      </div>
    );
  }

  const header = (
    <div>
      <p className="muted text-sm">{t.join.invitedTo}</p>
      <h1 className="text-2xl font-bold break-words">{room.name}</h1>
      <p className="muted mt-1 text-sm">{t.join.inside(room.member_count)}</p>
    </div>
  );

  if (room.pending) {
    return (
      <ActionForm action={cancelJoinRequest} className="card mx-auto mt-10 max-w-sm space-y-4 text-center">
        <p className="text-4xl">⏳</p>
        {header}
        <div>
          <p className="font-medium">{t.join.pendingTitle}</p>
          <p className="muted text-sm">{t.join.pendingHint}</p>
        </div>
        <input type="hidden" name="roomId" value={room.id} />
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-secondary">
            {t.common.goToRooms}
          </Link>
          <SubmitButton className="btn-ghost">{t.join.cancel}</SubmitButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={joinRoom} className="card mx-auto mt-10 max-w-sm space-y-4 text-center">
      <p className="text-4xl">💌</p>
      {header}
      {room.require_approval && <p className="muted text-sm">{t.join.needsApproval}</p>}
      <input type="hidden" name="code" value={code} />
      <SubmitButton pendingText={t.dashboard.joining}>
        {room.require_approval ? t.join.request : t.dashboard.join}
      </SubmitButton>
    </ActionForm>
  );
}
