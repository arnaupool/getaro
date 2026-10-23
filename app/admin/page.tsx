import Link from "next/link";
import { adminSetPublicUrl } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  AUDIT_CATEGORIES,
  checkSupabaseHealth,
  describeAudit,
  formatTimestamp,
  isAuditCategory,
  type AuditCategory,
  type AuditRow,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import type { Dict, Locale } from "@/lib/i18n/dictionaries";
import { RoomAvatar } from "@/components/RoomAvatar";
import { getI18n } from "@/lib/i18n/server";
import { roomImageUrl } from "@/lib/room-image";
import { getPublicUrl } from "@/lib/settings";
import { getVersion } from "@/lib/version";
import { createClient } from "@/lib/supabase/server";
import { ActivityChart, type ActivityPoint } from "./ActivityChart";
import { UserList, type AdminUser } from "./UserList";

const TABS = ["resum", "comptes", "sales", "historial", "sistema"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string }> }) {
  await requireAdmin();
  const { t, locale } = await getI18n();
  const { tab: rawTab, type } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "resum";

  const labels: Record<Tab, string> = {
    resum: t.admin.tabSummary,
    comptes: t.admin.tabUsers,
    sales: t.admin.tabRooms,
    historial: t.admin.tabHistory,
    sistema: t.admin.tabSystem,
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t.admin.title}</h1>

      <nav className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
          {TABS.map((key) => (
            <Link
              key={key}
              href={`/admin?tab=${key}`}
              replace
              className={`rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap ${
                tab === key ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {labels[key]}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "resum" && <SummaryTab t={t} />}
      {tab === "comptes" && <AccountsTab />}
      {tab === "sales" && <RoomsTab t={t} />}
      {tab === "historial" && <HistoryTab t={t} locale={locale} type={type} />}
      {tab === "sistema" && <SystemTab t={t} locale={locale} />}
    </div>
  );
}

// ── Resum ───────────────────────────────────────────────────

async function SummaryTab({ t }: { t: Dict }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_activity_summary");
  const summary = data as { today: number; week: number; month: number; series: ActivityPoint[] } | null;
  if (!summary) return <p className="muted text-sm">{t.errors.unexpected}</p>;

  const tiles = [
    { label: t.admin.today, value: summary.today },
    { label: t.admin.last7, value: summary.week },
    { label: t.admin.last30, value: summary.month },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">{t.admin.activeTitle}</h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="card px-3 py-3 text-center">
            <p className="text-3xl font-bold tabular-nums">{tile.value}</p>
            <p className="muted text-xs">{tile.label}</p>
          </div>
        ))}
      </div>
      <div className="card">
        {summary.month === 0 ? (
          <p className="muted text-sm">{t.admin.noActivity}</p>
        ) : (
          <ActivityChart series={summary.series} />
        )}
      </div>
    </section>
  );
}

// ── Comptes ─────────────────────────────────────────────────

async function AccountsTab() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users");
  return <UserList users={(data ?? []) as AdminUser[]} />;
}

// ── Sales ───────────────────────────────────────────────────

type AdminRoom = {
  id: string;
  name: string;
  emoji: string | null;
  image_path: string | null;
  owner: { display_name: string } | null;
  room_members: { count: number }[];
  events: { count: number }[];
  join_requests: { count: number }[];
};

async function RoomsTab({ t }: { t: Dict }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "id, name, emoji, image_path, owner:profiles!rooms_owner_id_fkey(display_name), room_members(count), events(count), join_requests(count)",
    )
    .order("created_at", { ascending: false })
    .returns<AdminRoom[]>();

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {(data ?? []).map((r) => {
        const pending = r.join_requests[0]?.count ?? 0;
        return (
          <li key={r.id}>
            <Link href={`/admin/rooms/${r.id}`} className="card flex gap-3 py-3 transition hover:border-violet-400">
              <RoomAvatar name={r.name} emoji={r.emoji} imageUrl={roomImageUrl(r.image_path)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{r.name}</p>
                <p className="muted text-sm">
                  {r.owner?.display_name ?? "—"} · {t.common.people(r.room_members[0]?.count ?? 0)} ·{" "}
                  {t.common.events(r.events[0]?.count ?? 0)}
                </p>
                {pending > 0 && (
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                    {t.dashboard.requestsBadge(pending)}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── Historial ───────────────────────────────────────────────

async function HistoryTab({ t, locale, type }: { t: Dict; locale: Locale; type?: string }) {
  const category: AuditCategory | null = isAuditCategory(type) ? type : null;
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200);
  if (category) query = query.in("action", [...AUDIT_CATEGORIES[category]]);
  const { data } = await query.returns<AuditRow[]>();
  const rows = data ?? [];

  const filters: { key: AuditCategory | null; label: string }[] = [
    { key: null, label: t.admin.filterAll },
    { key: "rooms", label: t.admin.filterRooms },
    { key: "people", label: t.admin.filterPeople },
    { key: "accounts", label: t.admin.filterAccounts },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={`/admin?tab=historial${f.key ? `&type=${f.key}` : ""}`}
            replace
            className={`badge px-3 py-1 text-sm ${
              category === f.key
                ? "bg-violet-600 text-white"
                : "bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted text-sm">{t.admin.historyEmpty}</p>
      ) : (
        <ul className="card divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="text-sm break-words">{describeAudit(row, t)}</p>
              <p className="muted text-xs">{formatTimestamp(row.at, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Sistema ─────────────────────────────────────────────────

async function SystemTab({ t, locale }: { t: Dict; locale: Locale }) {
  const supabase = await createClient();

  const [health, { data: dbBytes }, publicUrl] = await Promise.all([
    checkSupabaseHealth(),
    supabase.rpc("admin_db_size"),
    getPublicUrl(),
  ]);

  const usedMb = typeof dbBytes === "number" ? dbBytes / 1024 / 1024 : null;
  const usedPct = usedMb === null ? 0 : Math.min(100, (usedMb / 500) * 100);
  const version = getVersion();

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="card space-y-1">
        <p className="muted text-xs">{t.admin.supabase}</p>
        <p className={`font-semibold ${health.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
          {health.ok ? `● ${t.admin.responds(health.ms)}` : `● ${t.admin.down}`}
        </p>
      </div>

      <div className="card space-y-2">
        <p className="muted text-xs">{t.admin.dbSize}</p>
        <p className="font-semibold tabular-nums">{usedMb === null ? "—" : t.admin.dbUsed(usedMb.toFixed(1))}</p>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
          <div className="h-full rounded-full bg-violet-600 dark:bg-violet-500" style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      <div className="card space-y-1">
        <p className="muted text-xs">{t.admin.version}</p>
        {version ? (
          <>
            <a
              href={`https://github.com/arnaupool/getaro/commit/${version.sha}`}
              className="font-mono font-semibold text-violet-600 hover:underline dark:text-violet-400"
              target="_blank"
              rel="noreferrer"
            >
              {version.shortSha}
            </a>
            {version.builtAt && (
              <p className="muted text-xs">{t.admin.built(formatTimestamp(version.builtAt, locale))}</p>
            )}
          </>
        ) : (
          <p className="muted text-sm">{t.admin.devVersion}</p>
        )}
      </div>

      <ActionForm action={adminSetPublicUrl} className="card space-y-2 sm:col-span-3">
        <label className="label" htmlFor="publicUrl">
          {t.admin.publicUrl}
        </label>
        <p className="muted text-xs">{t.admin.publicUrlHint}</p>
        <div className="flex flex-wrap gap-2">
          <input
            id="publicUrl"
            name="publicUrl"
            inputMode="url"
            autoComplete="off"
            maxLength={200}
            defaultValue={publicUrl ?? ""}
            placeholder="https://getaro.example.com"
            className="input min-w-0 flex-1"
          />
          <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
