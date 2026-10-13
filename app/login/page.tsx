import { supabaseConfig } from "@/lib/config";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

/** ¿Está Google activado en Supabase? (Authentication > Providers). Si no se puede saber, se oculta. */
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const { url, key } = supabaseConfig();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const [{ t }, googleEnabled] = await Promise.all([getI18n(), isGoogleEnabled()]);
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="mx-auto mt-6 max-w-sm sm:mt-10">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          get<span className="text-violet-600">aro</span>
        </h1>
      </div>
      <div className="card mt-6">
        <LoginForm next={safeNext} googleEnabled={googleEnabled} devLogin={process.env.NODE_ENV === "development"} />
        {error && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{t.login.failed}</p>}
      </div>
    </div>
  );
}
