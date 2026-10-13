"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "./I18nProvider";

export type ActionState = { error?: string; ok?: string } | undefined;
type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Formulario ligado a una server action que devuelve { error } / { ok }. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{state.ok}</p>}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  confirm,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        const value = text.startsWith("/") ? window.location.origin + text : text;
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          window.prompt(t.copy.prompt, value);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? t.copy.copied : (label ?? t.copy.copy)}
    </button>
  );
}
