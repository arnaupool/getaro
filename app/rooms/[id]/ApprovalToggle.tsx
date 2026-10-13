"use client";

import { useActionState } from "react";
import { setRequireApproval } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

/** Interruptor "aprobar a las personas nuevas"; se guarda al cambiarlo */
export function ApprovalToggle({ roomId, enabled }: { roomId: string; enabled: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(setRequireApproval, undefined);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="roomId" value={roomId} />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="require_approval"
          defaultChecked={enabled}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600"
        />
        <span>
          <span className="block text-sm font-medium">{t.people.requireApproval}</span>
          <span className="muted block text-xs">{t.people.requireApprovalHint}</span>
        </span>
      </label>
      {state?.error && <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>}
    </form>
  );
}
