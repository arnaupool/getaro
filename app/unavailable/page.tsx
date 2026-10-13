import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function UnavailablePage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const { t } = await getI18n();
  const noProfile = reason === "no-profile";

  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-3 text-center">
      <h1 className="font-semibold">{noProfile ? t.errors.noProfileTitle : t.errors.unavailableTitle}</h1>
      <p className="muted text-sm">{noProfile ? t.errors.noProfileHint : t.errors.unavailableHint}</p>
      <Link href="/" className="btn-secondary">
        {t.errors.retry}
      </Link>
    </div>
  );
}
