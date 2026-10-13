import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { Avatar } from "./Avatar";
import { LanguageSelect } from "./LanguageSelect";
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
          <Link href="/admin" className="btn-ghost px-1.5 sm:px-2">
            {t.header.admin}
          </Link>
        )}
        <LanguageSelect />
        <ThemeToggle />
        {profile && (
          <>
            <Link href="/settings" className="btn-ghost" title={t.header.settings} aria-label={t.header.settings}>
              <Avatar member={profile} size="sm" />
            </Link>
            <form action="/auth/signout" method="post">
              <button className="btn-ghost" title={t.header.signOutTitle} aria-label={t.header.signOutTitle}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span className="hidden sm:inline">{t.header.signOut}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
