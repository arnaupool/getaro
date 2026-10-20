import { safeAvatarUrl } from "@/lib/avatar";
import type { Member } from "@/lib/types";

const SIZES = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-12 w-12 text-base" };

export function Avatar({ member, size = "md" }: { member: Member; size?: keyof typeof SIZES }) {
  const initial = member.display_name.trim().charAt(0).toUpperCase() || "?";
  const avatarUrl = safeAvatarUrl(member.avatar_url);
  return (
    <span
      title={member.display_name}
      className={`${SIZES[size]} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-white dark:ring-zinc-900`}
      style={{ backgroundColor: member.color }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

export function AvatarStack({ members, max = 5 }: { members: Member[]; max?: number }) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size="sm" />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold ring-2 ring-white dark:bg-zinc-700 dark:ring-zinc-900">
          +{rest}
        </span>
      )}
    </div>
  );
}
