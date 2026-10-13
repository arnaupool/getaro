const SIZES = { sm: "h-10 w-10 text-xl", md: "h-12 w-12 text-2xl", lg: "h-16 w-16 text-4xl" };

/** Imagen de una sala: foto si hay, si no su emoji, si no la inicial del nombre */
export function RoomAvatar({
  name,
  emoji,
  imageUrl,
  size = "md",
}: {
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-100 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300`}
      aria-hidden
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : emoji ? (
        emoji
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}
