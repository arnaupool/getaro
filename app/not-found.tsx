import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-3 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="font-semibold">{t.errors.notFound}</h1>
      <p className="muted text-sm">{t.errors.notFoundHint}</p>
      <Link href="/" className="btn-secondary">
        {t.common.goToRooms}
      </Link>
    </div>
  );
}
