import { deleteRoom, leaveRoom, regenerateInvite, removeMember, renameRoom, transferRoom } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { ActionForm, CopyButton, SubmitButton } from "@/components/forms";
import { getI18n } from "@/lib/i18n/server";
import type { getRoomContext } from "@/lib/room";

type Ctx = Awaited<ReturnType<typeof getRoomContext>>;

export async function PeopleTab({ ctx }: { ctx: Ctx }) {
  const { room, members, me, canManageRoom, isOwner, isMember } = ctx;
  const { t } = await getI18n();

  return (
    <div className="space-y-6">
      <ul className="card divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
        {members.map((m) => {
          const memberIsOwner = m.id === room.owner_id;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar member={m} />
              <span className="min-w-0 font-medium break-words">{m.display_name}</span>
              {m.id === me.id && <span className="badge bg-zinc-100 dark:bg-zinc-800">{t.common.you}</span>}
              {memberIsOwner && (
                <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {t.common.owner}
                </span>
              )}
              {canManageRoom && !memberIsOwner && (
                <div className="ml-auto flex gap-1">
                  <ActionForm action={transferRoom}>
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="userId" value={m.id} />
                    <SubmitButton
                      className="btn-ghost text-xs"
                      confirm={t.people.confirmMakeOwner(m.display_name, isOwner)}
                    >
                      {t.people.makeOwner}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={removeMember}>
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="userId" value={m.id} />
                    <SubmitButton
                      className="btn-ghost text-xs text-rose-600 dark:text-rose-400"
                      confirm={t.people.confirmRemove(m.display_name)}
                    >
                      {t.people.remove}
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isMember && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{t.people.inviteTitle}</h2>
          <p className="muted text-sm">{t.people.inviteHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-zinc-100 px-3 py-2 font-mono text-sm break-all dark:bg-zinc-800">
              /join/{room.invite_code}
            </code>
            <CopyButton text={`/join/${room.invite_code}`} />
            {canManageRoom && (
              <ActionForm action={regenerateInvite}>
                <input type="hidden" name="roomId" value={room.id} />
                <SubmitButton
                  className="btn-ghost"
                  confirm={t.people.confirmRegenerate}
                  pendingText={t.people.generating}
                >
                  {t.people.regenerate}
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </section>
      )}

      {canManageRoom && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{t.people.roomSettings}</h2>
          <ActionForm action={renameRoom} className="flex flex-wrap gap-2">
            <input type="hidden" name="roomId" value={room.id} />
            <input name="name" defaultValue={room.name} required maxLength={50} className="input sm:max-w-xs" />
            <SubmitButton className="btn-secondary">{t.people.rename}</SubmitButton>
          </ActionForm>
          <ActionForm action={deleteRoom}>
            <input type="hidden" name="roomId" value={room.id} />
            <SubmitButton
              className="btn-danger"
              confirm={t.people.confirmDeleteRoom(room.name)}
              pendingText={t.people.deleting}
            >
              {t.people.deleteRoom}
            </SubmitButton>
          </ActionForm>
        </section>
      )}

      {isMember && !isOwner && (
        <ActionForm action={leaveRoom}>
          <input type="hidden" name="roomId" value={room.id} />
          <SubmitButton className="btn-ghost text-rose-600 dark:text-rose-400" confirm={t.people.confirmLeave}>
            {t.people.leave}
          </SubmitButton>
        </ActionForm>
      )}
      {isOwner && <p className="muted text-xs">{t.people.ownerCantLeave}</p>}
    </div>
  );
}
