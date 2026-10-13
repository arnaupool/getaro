"use client";

import { useI18n } from "@/components/I18nProvider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-3 text-center">
      <p className="text-4xl">😵‍💫</p>
      <h1 className="font-semibold">{t.errors.title}</h1>
      <p className="muted text-sm">
        {process.env.NODE_ENV === "development" && error.message ? error.message : t.errors.unexpected}
      </p>
      <button className="btn-secondary" onClick={reset}>
        {t.errors.retry}
      </button>
    </div>
  );
}
