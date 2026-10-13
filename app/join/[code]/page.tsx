import Link from "next/link";
import { redirect } from "next/navigation";
import { joinRoom } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type Preview = { id: string; name: string; member_count: number; already_member: boolean };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  await requireProfile();
  const { t } = await getI18n();
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("room_preview", { code });
  const room = (data as Preview[] | null)?.[0];

  if (room?.already_member) redirect(`/rooms/${room.id}`);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      {room ? (
        <ActionForm action={joinRoom} className="card space-y-4 text-center">
          <p className="text-4xl">💌</p>
          <div>
            <p className="muted text-sm">{t.join.invitedTo}</p>
            <h1 className="text-2xl font-bold break-words">{room.name}</h1>
            <p className="muted mt-1 text-sm">{t.join.inside(room.member_count)}</p>
          </div>
          <input type="hidden" name="code" value={code} />
          <SubmitButton pendingText={t.dashboard.joining}>{t.dashboard.join}</SubmitButton>
        </ActionForm>
      ) : (
        <div className="card space-y-3 text-center">
          <p className="text-4xl">🤷‍♀️</p>
          <h1 className="font-semibold">{t.join.invalid}</h1>
          <p className="muted text-sm">{t.join.invalidHint}</p>
          <Link href="/" className="btn-secondary">
            {t.common.goToRooms}
          </Link>
        </div>
      )}
    </div>
  );
}
