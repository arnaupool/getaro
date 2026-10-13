import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";

export async function Header() {
  const [profile, { t }] = await Promise.all([getProfile(), getI18n()]);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/80 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-1 px-4 sm:gap-2">
        <Link href="/" className="mr-auto text-lg font-bold tracking-tight">
          get<span className="text-violet-600">aro</span>
        </Link>
        {profile?.is_admin && (
          <Link href="/admin" className="btn-ghost">
            {t.header.admin}
          </Link>
        )}
        <ThemeToggle />
        {profile && (
          <>
            <Link href="/settings" className="btn-ghost" title={t.header.settings} aria-label={t.header.settings}>
              <Avatar member={profile} size="sm" />
            </Link>
            <form action="/auth/signout" method="post">
              <button className="btn-ghost" title={t.header.signOutTitle}>
                {t.header.signOut}
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
